import { generatePodcastFromUrl } from "./podcastGeneration";
import { convertFromWavFile } from "./audioConversionService";
import { uploadEpisode, EpisodeMetadata } from "./redCircleService";
import { processDownload } from "./downloadUtils";
import { info, success } from "./logger";
import * as path from "path";

export type GenerateAndUploadOptions = {
  skipUpload?: boolean;
};

export type DirectUploadOptions = {
  title?: string;
  description?: string;
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

  if (!podcastResult.wavPath) {
    throw new Error("Podcast generation failed - no download available");
  }

  if (skipUpload) {
    info("Skipping conversion and upload as requested");
    return;
  }

  info("Step 2: Processing download and converting to MP3...");
  const downloadMetadata = await processDownload(podcastResult.wavPath);

  const conversionResult = await convertFromWavFile(downloadMetadata.wavPath, {
    outputPath: downloadMetadata.mp3Path,
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

/**
 * Upload an existing audio file directly to hosting service
 * @param filePath Path to the MP3 file to upload
 * @param options Upload options (title, description)
 */
export async function uploadExistingFile(filePath: string, options: DirectUploadOptions = {}) {
  info(`Starting direct upload for file: ${filePath}`);

  if (!filePath.endsWith(".mp3")) {
    throw new Error("Only MP3 files are supported for direct upload");
  }

  // Generate default title from filename if not provided
  const defaultTitle = path.basename(filePath, ".mp3");

  const episodeMetadata: EpisodeMetadata = {
    title: options.title || defaultTitle,
    description: options.description || `Uploaded from file: ${defaultTitle}`,
    filePath: filePath,
  };

  info(`Uploading to hosting service with title: ${episodeMetadata.title}`);
  await uploadEpisode(episodeMetadata);
  success("Episode uploaded successfully!");
}
