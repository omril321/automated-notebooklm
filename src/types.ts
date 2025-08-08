/**
 * Shared types for podcast generation and processing
 */

// Article content analysis result
export type ArticleAnalysis = {
  title: string;
  codeContentPercentage: number;
  isVideoArticle: boolean;
  totalTextLength: number;
  description: string | undefined;
};

/**
 * Base details interface for all podcast stages
 */
export interface BasePodcastDetails {
  title: string;
  description: string;
}

/**
 * Union type for all podcast stages
 */
export type PodcastDetails = PodcastIntention | GeneratedPodcast | ConvertedPodcast | UploadedPodcast;

/**
 * Initial intent to create a podcast from source URLs
 */
export interface PodcastIntention extends BasePodcastDetails {
  stage: "intention";
  sourceUrls: string[];
}

/**
 * Podcast that has been generated and downloaded as WAV
 */
export interface GeneratedPodcast extends BasePodcastDetails {
  stage: "generated";
  sourceUrls: string[];
  wavPath: string;
}

/**
 * Podcast that has been converted to MP3 format
 */
export interface ConvertedPodcast extends BasePodcastDetails {
  stage: "converted";
  sourceUrls: string[];
  wavPath: string;
  mp3Path: string;
}

/**
 * Podcast that has been uploaded to hosting platform
 */
export interface UploadedPodcast extends BasePodcastDetails {
  stage: "uploaded";
  sourceUrls: string[];
  wavPath: string;
  mp3Path: string;
  uploadedAt: Date;
  podcastUrl: string;
}

/**
 * Type guards for checking details stages
 */
export function isPodcastIntention(details: PodcastDetails): details is PodcastIntention {
  return details.stage === "intention";
}

export function isGeneratedPodcast(details: PodcastDetails): details is GeneratedPodcast {
  return details.stage === "generated";
}

export function isConvertedPodcast(details: PodcastDetails): details is ConvertedPodcast {
  return details.stage === "converted";
}

export function isUploadedPodcast(details: PodcastDetails): details is UploadedPodcast {
  return details.stage === "uploaded";
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
 * Progress details to generated stage
 */
export function toGeneratedPodcast(details: PodcastDetails, wavPath: string): GeneratedPodcast {
  return {
    ...details,
    stage: "generated",
    wavPath,
  };
}

/**
 * Progress details to converted stage
 */
export function toConvertedPodcast(details: GeneratedPodcast, mp3Path: string): ConvertedPodcast {
  return {
    ...details,
    stage: "converted",
    mp3Path,
  };
}

/**
 * Progress details to uploaded stage
 */
export function toUploadedPodcast(details: ConvertedPodcast, podcastUrl: string): UploadedPodcast {
  return {
    ...details,
    stage: "uploaded",
    uploadedAt: new Date(),
    podcastUrl,
  };
}
