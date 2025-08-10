import * as dotenv from "dotenv";
import { error } from "./logger";

dotenv.config();

export type Config = {
  googleEmail: string;
  googlePassword: string;
  redCircleUser?: string;
  redCirclePassword?: string;
  publishedPodcastName?: string;
};

/**
 * Load and validate environment configuration
 * @returns Configuration object with validated environment variables
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): Config {
  // Validate required environment variables
  const googleEmail = process.env.GOOGLE_USER_EMAIL;
  const googlePassword = process.env.GOOGLE_USER_PASSWORD;

  // Optional RedCircle credentials (for upload functionality)
  const redCircleUser = process.env.RED_CIRCLE_USER;
  const redCirclePassword = process.env.RED_CIRCLE_PASSWORD;
  const publishedPodcastName = process.env.PUBLISHED_PODCAST_NAME;

  // Check for missing required variables
  const missingVars = [];
  if (!googleEmail?.trim()) missingVars.push("GOOGLE_USER_EMAIL");
  if (!googlePassword?.trim()) missingVars.push("GOOGLE_USER_PASSWORD");

  // Only check for Google variables at config load time
  // RedCircle variables are checked separately when uploadEpisode is called
  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(", ")}`;
    error(errorMessage);
    error("Please create a .env file with the required variables.");
    throw new Error(errorMessage);
  }

  return {
    googleEmail: googleEmail!,
    googlePassword: googlePassword!,
    redCircleUser,
    redCirclePassword,
    publishedPodcastName,
  };
}
