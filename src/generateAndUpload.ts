import { generatePodcastFromExistingNotebook, generatePodcastFromUrl } from "./podcastGeneration";
import { convertToMp3 } from "./audioConversionService";
import { uploadEpisode } from "./redCircleService";
import { error, info, success } from "./logger";
import { GeneratedPodcast, UploadedPodcast } from "./types";
import { getPodcastCandidates, updateItemWithGeneratedPodcastUrl } from "./monday/service";
import { audioGenerationTracker } from "./services/audioGenerationTrackingService";
import { finalizePodcastDetails } from "./services/articleMetadataService";
import { ArticleCandidate } from "./monday/types";

const DEFAULT_DOWNLOADS_DIR = "./downloads";

export type GenerateAndUploadOptions = {
  outputDir?: string;
  mondayItemId?: string;
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

  const { outputDir = DEFAULT_DOWNLOADS_DIR, mondayItemId } = options;

  info("Starting podcast generation and upload...");

  info("Step 1: Generating podcast...");
  const { details: generatedDetails, metadata: generatedMetadata } = await generatePodcastFromUrl(url);

  info("Step 2: Converting to MP3...");
  const convertedPodcast = await convertToMp3(generatedDetails, { outputDir });

  success(`MP3 conversion completed: ${convertedPodcast.mp3Path}`);

  const { title, description } = finalizePodcastDetails(
    generatedMetadata,
    generatedDetails.notebookLmDetails,
    url,
    mondayItemId
  );
  info("Step 3: Uploading to hosting service...");
  const uploadedPodcast = await uploadEpisode(convertedPodcast, title, description);

  success(`Episode "${uploadedPodcast.finalTitle}" uploaded successfully!`);

  return uploadedPodcast;
}

type CandidateProcessingError = { id: string; name: string; reason: unknown };

function partitionCandidates(candidates: ArticleCandidate[]): {
  audioReady: ArticleCandidate[];
  regular: ArticleCandidate[];
} {
  const audioReady = candidates.filter((c) => Boolean(c.generatedAudioLink));
  const regular = candidates.filter((c) => !c.generatedAudioLink);
  return { audioReady, regular };
}

async function processCandidates(
  candidates: ArticleCandidate[],
  generateForCandidate: (candidate: ArticleCandidate) => Promise<GeneratedPodcast>
): Promise<{ processedCount: number; errors: CandidateProcessingError[] }> {
  const errors: CandidateProcessingError[] = [];
  let processedCount = 0;

  for (const candidate of candidates) {
    if (!candidate.sourceUrl) {
      error(`❌ Skipping candidate ${candidate.id}: No source URL found`);
      continue;
    }

    try {
      const details = await generateForCandidate(candidate);
      const podcastUrl = await uploadAndUpdateMondayItem(details, candidate);
      info(`🎯 Processed podcast URL: ${podcastUrl} for item ${candidate.id}`);
      processedCount += 1;
    } catch (candidateError) {
      error(`❌ Failed to process candidate ${candidate.id}: ${candidateError}`);
      errors.push({ id: candidate.id, name: candidate.name, reason: candidateError });
      continue;
    }
  }

  return { processedCount, errors };
}

function summarizeAndMaybeThrow(errors: CandidateProcessingError[]): void {
  if (errors.length === 0) return;
  const summary = errors.map((e) => `${e.id} (${e.name}): ${String(e.reason)}`).join("; ");
  throw new Error(`One or more candidates failed to process: ${summary}`);
}

async function processAudioReady(
  audioReadyCandidates: ArticleCandidate[]
): Promise<{ processedCount: number; errors: CandidateProcessingError[] }> {
  return processCandidates(audioReadyCandidates, async (candidate) => {
    const notebookUrl = candidate.generatedAudioLink!;
    const { details } = await generatePodcastFromExistingNotebook(notebookUrl, candidate.sourceUrl);
    return details;
  });
}

async function uploadAndUpdateMondayItem(details: GeneratedPodcast, candidate: ArticleCandidate): Promise<string> {
  const { title, description } = finalizePodcastDetails(
    details.metadata,
    details.notebookLmDetails,
    candidate.sourceUrl,
    candidate.id
  );
  const converted = await convertToMp3(details, { outputDir: DEFAULT_DOWNLOADS_DIR });
  const uploaded = await uploadEpisode(converted, title, description);
  await updateItemWithGeneratedPodcastUrl(candidate.id, uploaded.podcastUrl);
  return uploaded.podcastUrl;
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

  const { audioReady, regular } = partitionCandidates(candidates);

  info(`🔊 Found ${audioReady.length} audio-ready items. Processing first...`);
  const { processedCount: audioReadyProcessed, errors: audioReadyErrors } = await processAudioReady(audioReady);

  const remainingSlots = await audioGenerationTracker.validateRateLimit();
  const regularToProcess = remainingSlots > 0 ? regular.slice(0, remainingSlots) : [];
  const { processedCount, errors } = await processCandidates(regularToProcess, async (candidate) => {
    const { details } = await generatePodcastFromUrl(candidate.sourceUrl);
    return details;
  });
  summarizeAndMaybeThrow([...audioReadyErrors, ...errors]);

  success(`🎉 Completed processing ${audioReadyProcessed} audio-ready and ${processedCount} regular candidates.`);
}
