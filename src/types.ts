/**
 * Shared types for podcast generation and processing
 */

/**
 * Base metadata interface for all podcast stages
 */
export interface BaseMetadata {
  title: string;
  description: string;
}

/**
 * Union type for all podcast stages
 */
export type PodcastMetadata = PodcastIntention | GeneratedPodcast | ConvertedPodcast | UploadedPodcast;

/**
 * Initial intent to create a podcast from source URLs
 */
export interface PodcastIntention extends BaseMetadata {
  stage: "intention";
  sourceUrls: string[];
}

/**
 * Podcast that has been generated and downloaded as WAV
 */
export interface GeneratedPodcast extends BaseMetadata {
  stage: "generated";
  sourceUrls: string[];
  wavPath: string;
}

/**
 * Podcast that has been converted to MP3 format
 */
export interface ConvertedPodcast extends BaseMetadata {
  stage: "converted";
  sourceUrls: string[];
  wavPath: string;
  mp3Path: string;
}

/**
 * Podcast that has been uploaded to hosting platform
 */
export interface UploadedPodcast extends BaseMetadata {
  stage: "uploaded";
  sourceUrls: string[];
  wavPath: string;
  mp3Path: string;
  uploadedAt: Date;
  podcastUrl: string;
}

/**
 * Type guards for checking metadata stages
 */
export function isPodcastIntention(metadata: PodcastMetadata): metadata is PodcastIntention {
  return metadata.stage === "intention";
}

export function isGeneratedPodcast(metadata: PodcastMetadata): metadata is GeneratedPodcast {
  return metadata.stage === "generated";
}

export function isConvertedPodcast(metadata: PodcastMetadata): metadata is ConvertedPodcast {
  return metadata.stage === "converted";
}

export function isUploadedPodcast(metadata: PodcastMetadata): metadata is UploadedPodcast {
  return metadata.stage === "uploaded";
}

/**
 * Create a new podcast intention
 */
export function createPodcastIntention(sourceUrl: string, title: string, description: string): PodcastIntention {
  return {
    stage: "intention",
    sourceUrls: [sourceUrl],
    title,
    description,
  };
}

/**
 * Progress metadata to generated stage
 */
export function toGeneratedPodcast(metadata: PodcastMetadata, wavPath: string): GeneratedPodcast {
  return {
    ...metadata,
    stage: "generated",
    wavPath,
  };
}

/**
 * Progress metadata to converted stage
 */
export function toConvertedPodcast(metadata: GeneratedPodcast, mp3Path: string): ConvertedPodcast {
  return {
    ...metadata,
    stage: "converted",
    mp3Path,
  };
}

/**
 * Progress metadata to uploaded stage
 */
export function toUploadedPodcast(metadata: ConvertedPodcast, podcastUrl: string): UploadedPodcast {
  return {
    ...metadata,
    stage: "uploaded",
    uploadedAt: new Date(),
    podcastUrl,
  };
}
