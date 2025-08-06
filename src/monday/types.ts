/**
 * Monday.com Integration Types
 * Application-specific types that extend the official Monday.com API types
 */

// Re-export the official Monday.com types we need
export type { Board, Column, ColumnValue } from "@mondaydotcomorg/api";

// Application-specific configuration type (not available in the official packages)
export type MondayConfig = {
  readonly apiToken: string;
  readonly boardUrl: string;
  readonly boardId: string;
};

export type SourceBoardItem = {
  readonly id: string;
  readonly name: string;
  readonly sourceUrlValue?: { url?: string | null; text?: string | null } | null;
  readonly podcastFitness: number;
};

// Application-specific filtered article candidate type
export type ArticleCandidate = {
  readonly id: string;
  readonly name: string;
  readonly sourceUrl: `${"http"}${string}`;
};
