/**
 * Shared types for podcast generation and processing
 */

import { ArticleMetadata } from "./monday/types";

/**
 * Base details interface for all podcast stages
 */
export interface BasePodcastDetails {
  metadata: ArticleMetadata;
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
  notebookLmDetails: {
    title: string;
    description: string;
  };
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
  finalDescription: string;
  finalTitle: string;
}

/**
 * Create a new podcast intention
 */
export function createPodcastIntention(sourceUrl: string, metadata: ArticleMetadata): PodcastIntention {
  return {
    stage: "intention",
    sourceUrls: [sourceUrl],
    metadata,
  };
}

/**
 * Progress details to generated stage
 */
export function toGeneratedPodcast(
  intention: PodcastIntention,
  wavPath: string,
  notebookLmDetails: {
    title: string;
    description: string;
  }
): GeneratedPodcast {
  return {
    ...intention,
    stage: "generated",
    wavPath,
    notebookLmDetails,
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
export function toUploadedPodcast(
  converted: ConvertedPodcast,
  podcastUrl: string,
  finalTitle: string,
  finalDescription: string
): UploadedPodcast {
  return {
    ...converted,
    stage: "uploaded",
    uploadedAt: new Date(),
    podcastUrl,
    finalTitle,
    finalDescription,
  };
}
