import { getMondayApiClient } from "./api-client";
import { createConfigFromEnvironment, REQUIRED_COLUMNS } from "./config";
import { MondayError, MondayErrorType } from "./errors";
import { ArticleCandidate, SourceBoardItem } from "./types";
import { validateBoardAccess } from "./board-validator";
import { GetBoardItemsOpQuery, LinkValue } from "@mondaydotcomorg/api";

const findCandidates = (items: SourceBoardItem[]): ArticleCandidate[] => {
  return (
    items
      .filter((item): item is SourceBoardItem => Boolean(item.podcastFitness > 0))
      // sort descending - highest fitness first
      .sort((a, b) => b.podcastFitness - a.podcastFitness)
      .map((item) => ({
        id: item.id,
        name: item.name,
        sourceUrl: item.sourceUrlValue?.url as `${"http"}${string}`,
      }))
  );
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
      (cv) => cv.id === REQUIRED_COLUMNS.podcastFitness.id
    ) as unknown as {
      display_value: string;
    };
    const sourceUrlValue = parseSourceUrl(rawSourceUrl);
    return {
      id: item.id,
      name: item.name,
      sourceUrlValue,
      podcastFitness: Number(rawFittingForPodcast.display_value),
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
  const candidates = findCandidates(boardItems);
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

  await apiClient.operations.changeColumnValueOp({
    boardId: config.boardId,
    itemId,
    columnId: REQUIRED_COLUMNS.podcastLink.id,
    value: `"${podcastUrl}"`,
  });
}
