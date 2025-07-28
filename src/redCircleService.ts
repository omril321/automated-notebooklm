export type EpisodeMetadata = {
  title: string;
  description: string;
  filePath: string;
};

/**
 * Upload episode file and metadata to RedCircle
 * @param metadata Episode metadata including title, description, and file path
 * @returns Promise<void> - throws on failure
 */
export async function uploadEpisode(metadata: EpisodeMetadata): Promise<void> {
  // TODO: Implement RedCircle upload functionality
  // This will be implemented once we understand the actual RedCircle interface

  throw new Error(`RedCircle upload not yet implemented for: ${metadata.title}`);
}
