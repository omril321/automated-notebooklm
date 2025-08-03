import { MondayConfig } from "./types";
import { MondayError, MondayErrorType } from "./errors";

const REQUIRED_COLUMNS = {
  podcastLink: { title: "Podcast link", type: "url" },
  type: { title: "Type", type: "status" },
  sourceUrl: { title: "🔗", type: "url" },
} as const;

/**
 * Extract board ID from Monday.com board URL (supports views and filters)
 */
const extractBoardIdFromUrl = (boardUrl: string): string => {
  const urlRegex = /https:\/\/[^.]+\.monday\.com\/boards\/(\d+)/;
  const match = boardUrl.match(urlRegex);

  if (!match || !match[1]) {
    throw new MondayError(
      MondayErrorType.INVALID_CONFIG,
      `Invalid Monday.com board URL format: ${boardUrl}. Expected format: https://company.monday.com/boards/123456789 (views and filters are supported)`
    );
  }

  return match[1];
};

/**
 * Create configuration from environment variables
 */
export const createConfigFromEnvironment = (): MondayConfig => {
  if (!process.env.MONDAY_API_TOKEN) {
    throw new MondayError(MondayErrorType.INVALID_CONFIG, "MONDAY_API_TOKEN environment variable is required");
  }

  if (!process.env.MONDAY_BOARD_URL) {
    throw new MondayError(MondayErrorType.INVALID_CONFIG, "MONDAY_BOARD_URL environment variable is required");
  }

  const boardUrl = process.env.MONDAY_BOARD_URL;
  const boardId = extractBoardIdFromUrl(boardUrl);

  return {
    apiToken: process.env.MONDAY_API_TOKEN,
    boardUrl,
    boardId,
  };
};

/**
 * Get required column configuration for validation
 */
export const getRequiredColumns = () => REQUIRED_COLUMNS;
