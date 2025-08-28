// Application-specific configuration type (not available in the official packages)
export type MondayConfig = {
  readonly apiToken: string;
  readonly boardUrl: string;
  readonly boardId: string;
  readonly excludedGroups: readonly string[]; // Array of group IDs to exclude
};

export type SourceBoardItem = {
  readonly id: string;
  readonly name: string;
  readonly sourceUrlValue?: { url?: string | null; text?: string | null } | null;
  readonly type: "Article" | string | undefined;
  readonly podcastFitness: number;
  readonly metadata?: ArticleMetadata;
  readonly nonPodcastable?: boolean | null;
};

export type ArticleCandidate = {
  readonly id: string;
  readonly name: string;
  readonly sourceUrl: `${"http"}${string}`;
  readonly metadata: Partial<ArticleMetadata> | undefined;
};

export type ArticleMetadata = {
  readonly title: string;
  readonly description: string | undefined;
  readonly contentType: "Video" | "Article";
  readonly isNonPodcastable: boolean;
  readonly codeContentPercentage: number;
  readonly totalTextLength: number;
};
