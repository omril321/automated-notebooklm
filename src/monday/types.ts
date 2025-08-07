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
  readonly type: "Article" | string | undefined;
  readonly podcastFitness: number;
  readonly metadata?: string | null;
  readonly nonPodcastable?: boolean | null;
};

export type ArticleCandidate = {
  readonly id: string;
  readonly name: string;
  readonly sourceUrl: `${"http"}${string}`;
};

export type ArticleMetadata = {
  readonly title: string;
  readonly description: string | undefined;
  readonly contentType: "Video" | "Article";
  readonly isNonPodcastable: boolean;
  readonly codeContentPercentage: number;
  readonly totalTextLength: number;
};
