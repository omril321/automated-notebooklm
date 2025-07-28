import { generatePodcastFromUrl } from "./podcastGeneration";
import { convertFromDownload } from "./audioConversionService";
import { uploadEpisode, EpisodeMetadata } from "./redCircleService";
import { processDownload } from "./downloadUtils";
import { info, success } from "./logger";

export type GenerateAndUploadOptions = {
  skipUpload?: boolean;
};

export type GenerateAndUploadResult = {
  mp3FilePath: string;
};

/**
 * Generate podcast from URL, convert to MP3, and upload
 * @param url Source URL to generate podcast from
 * @param options Flow options
 * @returns Promise with results
 */
export async function generateAndUpload(url: string, options: GenerateAndUploadOptions = {}) {
  const { skipUpload = false } = options;

  info("Starting podcast generation and upload...");

  info("Step 1: Generating podcast...");
  const podcastResult = await generatePodcastFromUrl(url);

  if (!podcastResult.wavDownload) {
    throw new Error("Podcast generation failed - no download available");
  }

  if (skipUpload) {
    info("Skipping conversion and upload as requested");
    return;
  }

  info("Step 2: Processing download and converting to MP3...");
  const downloadMetadata = await processDownload(podcastResult.wavDownload);

  const conversionResult = await convertFromDownload(podcastResult.wavDownload, {
    outputPath: downloadMetadata.outputPath,
    title: downloadMetadata.title,
  });

  success(`MP3 conversion completed: ${conversionResult.outputPath}`);

  info("Step 3: Uploading to hosting service...");

  const episodeMetadata: EpisodeMetadata = {
    title: downloadMetadata.title,
    description: downloadMetadata.description,
    filePath: conversionResult.outputPath,
  };

  await uploadEpisode(episodeMetadata);
  success("Episode uploaded successfully!");
}
