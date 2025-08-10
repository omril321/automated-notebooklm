import { generatePodcastFromUrl } from "./podcastGeneration";
import { convertToMp3 } from "./audioConversionService";
import { uploadEpisode } from "./redCircleService";
import { error, info, success } from "./logger";
import { UploadedPodcast } from "./types";
import { getPodcastCandidates, updateItemWithGeneratedPodcastUrl } from "./monday/service";
import { finalizePodcastDetails } from "./services/articleMetadataService";

const DEFAULT_DOWNLOADS_DIR = "./downloads";

export type GenerateAndUploadOptions = {
  outputDir?: string;
};

/**
 * Generate podcast from URL, convert to MP3, and upload
 * @param url Source URL to generate podcast from
 * @param options Flow options
 */
export async function generateAndUpload(url: string, options: GenerateAndUploadOptions = {}): Promise<UploadedPodcast> {
  if (!url?.trim()) {
    throw new Error("generateAndUpload: 'url' must be a non-empty string");
  }

  const { outputDir = DEFAULT_DOWNLOADS_DIR } = options;

  info("Starting podcast generation and upload...");

  info("Step 1: Generating podcast...");
  const { details: generatedDetails, metadata: generatedMetadata } = await generatePodcastFromUrl(url);

  info("Step 2: Converting to MP3...");
  const convertedPodcast = await convertToMp3(generatedDetails, { outputDir });

  success(`MP3 conversion completed: ${convertedPodcast.mp3Path}`);

  const { title, description } = finalizePodcastDetails(generatedMetadata, generatedDetails.notebookLmDetails);
  info("Step 3: Uploading to hosting service...");
  const uploadedPodcast = await uploadEpisode(convertedPodcast, title, description);

  success(`Episode "${uploadedPodcast.finalTitle}" uploaded successfully!`);

  return uploadedPodcast;
}

export async function generateAndUploadFromMondayBoardCandidates(): Promise<void> {
  info("🔍 Fetching podcast candidates from Monday board...");

  const candidates = await getPodcastCandidates();
  success(`📋 Found ${candidates.length} podcast candidates`);

  if (candidates.length === 0) {
    info(
      "🎯 No valid podcast candidates found. Make sure your Monday board view contains articles with valid URLs and empty podcast link fields."
    );
    return;
  }

  for (const candidate of candidates) {
    if (!candidate.sourceUrl) {
      error(`❌ Skipping candidate ${candidate.id}: No source URL found`);
      continue;
    }

    info(`\n🎙️ Processing: ${candidate.name}`);
    info(`🔗 Source URL: ${candidate.sourceUrl}`);

    try {
      const { podcastUrl } = await generateAndUpload(candidate.sourceUrl);

      info(`🎯 Generated podcast URL: ${podcastUrl}`);
      info(`📝 Updating Monday board for item ${candidate.id}...`);

      await updateItemWithGeneratedPodcastUrl(candidate.id, podcastUrl);
      success(`✅ Successfully updated Monday board for: ${candidate.name} (id: ${candidate.id})`);
    } catch (candidateError) {
      // Abort entire batch on first failure to avoid partial board updates
      error(`❌ Failed to process candidate ${candidate.id}: ${candidateError}`);
      throw candidateError;
    }
  }

  success(`🎉 Completed processing ${candidates.length} podcast candidates!`);
}
