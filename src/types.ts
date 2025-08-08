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
export interface GeneratedPodcast extends Omit<PodcastIntention, "stage"> {
  stage: "generated";
  wavPath: string;
}

/**
 * Podcast that has been converted to MP3 format
 */
export interface ConvertedPodcast extends Omit<GeneratedPodcast, "stage"> {
  stage: "converted";
  mp3Path: string;
}

/**
 * Podcast that has been uploaded to hosting platform
 */
export interface UploadedPodcast extends Omit<ConvertedPodcast, "stage"> {
  stage: "uploaded";
  uploadedAt: Date;
  podcastUrl: string;
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
export function toGeneratedPodcast(
  intention: PodcastIntention,
  wavPath: string,
  title: string,
  description: string
): GeneratedPodcast {
  return {
    ...intention,
    stage: "generated",
    wavPath,
    title,
    description,
  };
}

/**
 * Progress details to converted stage
 */
export function toConvertedPodcast(generated: GeneratedPodcast, mp3Path: string): ConvertedPodcast {
  return {
    ...generated,
    stage: "converted",
    mp3Path,
  };
}

/**
 * Progress details to uploaded stage
 */
export function toUploadedPodcast(converted: ConvertedPodcast, podcastUrl: string): UploadedPodcast {
  return {
    ...converted,
    stage: "uploaded",
    uploadedAt: new Date(),
    podcastUrl,
  };
}
