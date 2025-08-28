import { MondayConfig } from "./types";
import { MondayError, MondayErrorType } from "./errors";
import { ColumnType } from "@mondaydotcomorg/api";

// While this structure may change with time, currently it's hard coded.
export const REQUIRED_COLUMNS = {
  podcastLink: { title: "Podcast link", type: ColumnType.Text, id: "text_mktjay7" },
  type: { title: "Type", type: ColumnType.Status, id: "label" },
  sourceUrl: { title: "🔗", type: ColumnType.Link, id: "link" },
  podcastFitness: { title: "Podcast fitness", type: ColumnType.Formula, id: "formula_mkth15m8" },
  metadata: { title: "Metadata", type: ColumnType.LongText, id: "long_text_mktjet6j" },
  nonPodcastable: { title: "Non-podcastable", type: ColumnType.Checkbox, id: "boolean_mktjmap0" },
  notebookLmWithGeneratedAudio: {
    title: "NotebookLM with generated audio",
    type: ColumnType.Link,
    id: "link_mkv7tbhg",
  },
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

  // Parse excluded group IDs from environment variable (comma-separated)
  // Note: These should be group IDs (e.g., "group_title"), not group titles (e.g., "Done")
  if (!process.env.MONDAY_EXCLUDED_GROUP_IDS) {
    throw new MondayError(MondayErrorType.INVALID_CONFIG, "MONDAY_EXCLUDED_GROUP_IDS environment variable is required");
  }

  const excludedGroups = process.env.MONDAY_EXCLUDED_GROUP_IDS.split(",").map((group) => group.trim());

  return {
    apiToken: process.env.MONDAY_API_TOKEN,
    boardUrl,
    boardId,
    excludedGroups,
  };
};
