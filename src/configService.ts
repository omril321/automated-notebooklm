import * as dotenv from "dotenv";
import { error } from "./logger";

dotenv.config();

export interface Config {
  googleEmail: string;
  googlePassword: string;
}

/**
 * Load and validate environment configuration
 * @returns Configuration object with validated environment variables
 * @throws Error if required environment variables are missing
 */
export function loadConfig(): Config {
  // Validate required environment variables
  const googleEmail = process.env.GOOGLE_USER_EMAIL;
  const googlePassword = process.env.GOOGLE_USER_PASSWORD;

  // Check for missing required variables
  const missingVars = [];
  if (!googleEmail) missingVars.push("GOOGLE_USER_EMAIL");
  if (!googlePassword) missingVars.push("GOOGLE_USER_PASSWORD");

  if (missingVars.length > 0) {
    error(`Missing required environment variables: ${missingVars.join(", ")}`);
    error("Please create a .env file with the required variables.");
    throw new Error("Missing required environment variables");
  }

  return {
    googleEmail: googleEmail!,
    googlePassword: googlePassword!,
  };
}
