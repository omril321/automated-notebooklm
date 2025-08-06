import { getMondayApiClient } from "./api-client";
import { createConfigFromEnvironment, REQUIRED_COLUMNS } from "./config";
import { MondayError, MondayErrorType } from "./errors";
import { ArticleCandidate, SourceBoardItem } from "./types";
import { validateBoardAccess } from "./board-validator";
import { GetBoardItemsOpQuery, LinkValue } from "@mondaydotcomorg/api";

const filterCandidates = (items: SourceBoardItem[]): ArticleCandidate[] => {
  return items
    .filter((item): item is SourceBoardItem =>
      Boolean(item.fittingForPodcast && item.sourceUrlValue?.url?.startsWith("http"))
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      sourceUrl: item.sourceUrlValue?.url as `${"http"}${string}`,
    }));
};

const findPodcastLink = (response: GetBoardItemsOpQuery) => {
  if (response.boards?.length !== 1) {
    throw new Error("Unexpected response from Monday API - expected 1 board, got " + response.boards?.length);
  }
  if (response.boards[0]?.items_page?.items?.length !== 1) {
    throw new Error(
      "Unexpected response from Monday API - expected 1 item, got " + response.boards?.[0]?.items_page?.items?.length
    );
  }
  const item = response.boards[0].items_page.items[0];
  const podcastLinkColumn = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.podcastLink.id);
  return podcastLinkColumn?.value as string | undefined;
};

/**
 * Check if podcast link field is already populated
 */
const validatePodcastLinkEmpty = (podcastLinkValue: string | undefined, itemId: string): void => {
  if (podcastLinkValue) {
    throw new MondayError(MondayErrorType.API_ERROR, `Podcast link field is not empty for item ${itemId}`);
  }
};

function parseSourceUrl(sourceUrlRaw: string): Pick<LinkValue, "url" | "text"> | undefined {
  try {
    const sourceUrl = JSON.parse(sourceUrlRaw);
    return sourceUrl;
  } catch (error) {
    return undefined;
  }
}

function parseBoardItems(items: GetBoardItemsOpQuery): SourceBoardItem[] {
  if (!items.boards?.[0]?.items_page?.items) {
    throw new MondayError(MondayErrorType.API_ERROR, "Unexpected response from Monday API - no items found");
  }

  return items.boards[0].items_page.items.map((item) => {
    const rawSourceUrl = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.sourceUrl.id)?.value;
    const rawFittingForPodcast = item.column_values.find(
      (cv) => cv.id === REQUIRED_COLUMNS.fittingForPodcast.id
    ) as unknown as {
      display_value: string;
    };
    const sourceUrlValue = parseSourceUrl(rawSourceUrl);
    return {
      id: item.id,
      name: item.name,
      sourceUrlValue,
      fittingForPodcast: rawFittingForPodcast?.display_value?.toLowerCase() === "true",
    };
  });
}
/**
 * Fetch podcast candidates from Monday board
 * @param maxItems Maximum number of candidates to fetch (default: 3)
 * @returns Array of article candidates with valid URLs
 */
export async function getPodcastCandidates(maxItems: number = 3): Promise<ArticleCandidate[]> {
  const config = createConfigFromEnvironment();
  await validateBoardAccess(config.boardId);
  const apiClient = getMondayApiClient();

  const LIMIT = 500;
  const query = `
    query GetBoardItems($boardId: [ID!]) {
      boards(ids: $boardId) {
        items_page(limit: ${LIMIT}) {
          items {
            id
            name
            column_values {
              id
              value
              text
              type
              ... on FormulaValue {
                display_value
              }
            }
          }
        }
      }
    }
  `;
  const response = await apiClient.request<GetBoardItemsOpQuery>(query, { boardId: [config.boardId] });

  const boardItems = parseBoardItems(response);
  if (boardItems.length === LIMIT) {
    throw new MondayError(
      MondayErrorType.API_ERROR,
      "Limit reached - we need to support pagination or add some filtering"
    );
  }
  const candidates = filterCandidates(boardItems);
  return candidates.slice(0, maxItems);
}

/**
 * Update Monday board item with generated podcast URL
 * Ensures the podcast link field is empty before updating
 * @param itemId Monday board item ID
 * @param podcastUrl Generated podcast URL to update
 * @returns Update result with success status
 */
export async function updateItemWithGeneratedPodcastUrl(itemId: string, podcastUrl: string) {
  const config = createConfigFromEnvironment();
  await validateBoardAccess(config.boardId);
  const apiClient = getMondayApiClient();

  const item = await apiClient.operations.getBoardItemsOp({ ids: [itemId] });

  const podcastLinkValue = findPodcastLink(item);
  validatePodcastLinkEmpty(podcastLinkValue, itemId);

  await apiClient.operations.changeColumnValueOp({
    boardId: config.boardId,
    itemId,
    columnId: REQUIRED_COLUMNS.podcastLink.id,
    value: JSON.stringify({
      url: podcastUrl,
      text: podcastUrl,
    }),
  });
}
