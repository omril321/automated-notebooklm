import { generatePodcastFromUrl } from "./podcastGeneration";
import { convertToMp3 } from "./audioConversionService";
import { uploadEpisode } from "./redCircleService";
import { info, success } from "./logger";
import * as path from "path";
import { toUploadedPodcast, toConvertedPodcast, toGeneratedPodcast } from "./types";

export type GenerateAndUploadOptions = {
  skipUpload?: boolean;
  outputDir?: string;
};

export type DirectUploadOptions = {
  title?: string;
  description?: string;
};

/**
 * Generate podcast from URL, convert to MP3, and upload
 * @param url Source URL to generate podcast from
 * @param options Flow options
 */
export async function generateAndUpload(url: string, options: GenerateAndUploadOptions = {}) {
  const { skipUpload = false, outputDir = "./downloads" } = options;

  info("Starting podcast generation and upload...");

  info("Step 1: Generating podcast...");
  const { metadata: generatedPodcast } = await generatePodcastFromUrl(url);

  if (skipUpload) {
    info("Skipping conversion and upload as requested");
    return;
  }

  info("Step 2: Converting to MP3...");
  // Convert the WAV to MP3
  const convertedPodcast = await convertToMp3(generatedPodcast, { outputDir });

  success(`MP3 conversion completed: ${convertedPodcast.mp3Path}`);

  info("Step 3: Uploading to hosting service...");
  await uploadEpisode(convertedPodcast);

  // Mark as uploaded in metadata
  const uploadedPodcast = toUploadedPodcast(convertedPodcast);

  success(`Episode "${uploadedPodcast.title}" uploaded successfully!`);
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

  // Create metadata
  const intentionMetadata = toGeneratedPodcast(
    {
      stage: "intention",
      sourceUrls: [`file://${filePath}`],
      title: options.title || defaultTitle,
      description: options.description || `Uploaded from file: ${defaultTitle}`,
    },
    filePath
  );

  // Create converted podcast metadata
  const convertedPodcast = toConvertedPodcast(intentionMetadata, filePath);

  info(`Uploading to hosting service with title: ${convertedPodcast.title}`);
  await uploadEpisode(convertedPodcast);

  // Mark as uploaded in metadata
  const uploadedPodcast = toUploadedPodcast(convertedPodcast);

  success(`Episode "${uploadedPodcast.title}" uploaded successfully!`);
}
