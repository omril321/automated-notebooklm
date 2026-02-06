import * as dotenv from "dotenv";
import { info } from "./logger";

dotenv.config();

export type Config = {
  redCircleUser?: string;
  redCirclePassword?: string;
  publishedPodcastName?: string;
};

/**
 * Load and validate environment configuration
 * @returns Configuration object with validated environment variables
 */
export function loadConfig(): Config {
  // Optional RedCircle credentials (for upload functionality)
  const redCircleUser = process.env.RED_CIRCLE_USER;
  const redCirclePassword = process.env.RED_CIRCLE_PASSWORD;
  const publishedPodcastName = process.env.PUBLISHED_PODCAST_NAME;

  // CLI mode handles authentication separately via notebooklm-py
  info("Using CLI-based NotebookLM (authenticate via: ./scripts/nlm login)");

  return {
    redCircleUser,
    redCirclePassword,
    publishedPodcastName,
  };
}
