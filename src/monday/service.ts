import { getMondayApiClient } from "./api-client";
import { createConfigFromEnvironment, REQUIRED_COLUMNS } from "./config";
import { MondayError, MondayErrorType } from "./errors";
import { ArticleCandidate, SourceBoardItem, ArticleMetadata } from "./types";
import { validateBoardAccess } from "./board-validator";
import { GetBoardItemsOpQuery, LinkValue } from "@mondaydotcomorg/api";
import { extractMetadataBatch } from "../services/articleMetadataService";
import { processBatch } from "../utils/promiseUtils";
import * as logger from "../logger";

const ARTICLE_TYPE = "Article";
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 15000; // 15 seconds

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
        metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
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
    const rawMetadata = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.metadata.id)?.value;
    const rawNonPodcastable = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.nonPodcastable.id)?.value;
    const type = (item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.type.id) as undefined | { text: string })
      ?.text;

    const sourceUrlValue = parseSourceUrl(rawSourceUrl);

    return {
      id: item.id,
      name: item.name,
      sourceUrlValue,
      podcastFitness: Number(rawFittingForPodcast.display_value),
      metadata: rawMetadata || null,
      nonPodcastable: rawNonPodcastable ? JSON.parse(rawNonPodcastable).checked : null,
      type,
    };
  });
}

/**
 * Update Monday board item with metadata and URL information
 */
async function updateUrlNamedItemWithRealName(itemId: string, newName: string, url: string) {
  const config = createConfigFromEnvironment();
  const apiClient = getMondayApiClient();

  logger.info(`Updating item ${itemId} with extracted title: "${newName}"`);

  const columnValues = {
    name: newName,
    [REQUIRED_COLUMNS.sourceUrl.id]: { url, text: url },
  };

  await apiClient.operations.changeMultipleColumnValuesOp({
    boardId: config.boardId,
    itemId,
    columnValues: JSON.stringify(columnValues),
  });

  logger.success(`Updated item ${itemId} with URL and title`);
}

/**
 * Update Monday board item with metadata only (for items that already have URLs)
 */
async function updateItemWithMetadata(itemId: string, metadata: ArticleMetadata) {
  const config = createConfigFromEnvironment();
  const apiClient = getMondayApiClient();

  logger.info(`Updating item ${itemId} with metadata (type: ${metadata.contentType})`);

  const columnValues = {
    [REQUIRED_COLUMNS.type.id]: metadata.contentType,
    [REQUIRED_COLUMNS.metadata.id]: { text: JSON.stringify(metadata) },
    [REQUIRED_COLUMNS.nonPodcastable.id]: { checked: metadata.isNonPodcastable.toString() },
  };

  await apiClient.operations.changeMultipleColumnValuesOp({
    boardId: config.boardId,
    itemId,
    columnValues: JSON.stringify(columnValues),
  });

  logger.success(`Updated item ${itemId} with metadata`);
}

/**
 * Update items that only have URLs in their names, and have no source URL value.
 * This probably means that the item was inserted manually, and the URL is in the name.
 * This function will extract the metadata from the URL and update the item with the URL and metadata.
 * Uses batching to avoid hitting API concurrency limits.
 */
async function updateItemsWithUrlsInNames(): Promise<void> {
  const items = await getBoardItems();
  const itemsWithUrlsInNames = items.filter((item) => {
    // names with spaces mean they are not "pure" links, so we skip them
    const isValidLinkOnly =
      !item.name.includes(" ") && URL.canParse(item.name) && new URL(item.name).protocol.startsWith("http");
    const isNotAlreadyUpdated = !item.sourceUrlValue?.url;
    return isValidLinkOnly && isNotAlreadyUpdated;
  });

  if (!itemsWithUrlsInNames.length) {
    logger.info("No items with URLs in names found, skipping");
    return;
  }

  logger.info(`Processing ${itemsWithUrlsInNames.length} items with URLs in names using batches of ${BATCH_SIZE}`);

  const urls = itemsWithUrlsInNames.map((item) => item.name);
  const metadataResults = await extractMetadataBatch(urls);

  // Process items in batches with delays
  await processBatch(
    itemsWithUrlsInNames,
    async (item) => {
      const url = item.name;
      const metadata = metadataResults.get(url);
      if (!metadata) {
        logger.warning(`No metadata found for item ${item.id} with URL ${url}`);
        return;
      }
      const newName = metadata.title;
      await updateUrlNamedItemWithRealName(item.id, newName, url);
    },
    {
      batchSize: BATCH_SIZE,
      delayMs: BATCH_DELAY_MS,
      logItemName: "items",
    }
  );

  logger.success(`Updated ${itemsWithUrlsInNames.length} items with extracted metadata using batched processing`);
}

/**
 * Update items that have source URL value, but no metadata.
 * This function will extract the metadata from the URL and update the item with the metadata.
 * Uses batching to avoid hitting API concurrency limits.
 */
async function updateItemsWithMissingMetadata(): Promise<void> {
  const items = await getBoardItems();
  const articleItems = items.filter((item) => item.type === ARTICLE_TYPE);
  if (!articleItems.length) {
    throw new Error(
      `No article items found - this probably means that the board is not configured correctly, or that the article type is different than ${ARTICLE_TYPE}`
    );
  }

  const itemsWithMissingMetadata = articleItems.filter((item) => !item.metadata && item.sourceUrlValue?.url);

  if (!itemsWithMissingMetadata.length) {
    logger.info("No items with missing metadata found, skipping");
    return;
  }

  logger.info(
    `Processing ${itemsWithMissingMetadata.length} items with missing metadata using batches of ${BATCH_SIZE}`
  );

  const urls = itemsWithMissingMetadata
    .map((item) => item.sourceUrlValue?.url)
    .filter((url): url is string => Boolean(url));

  const metadataResults = await extractMetadataBatch(urls);

  // Process items in batches with delays
  await processBatch(
    itemsWithMissingMetadata,
    async (item) => {
      const url = item.sourceUrlValue?.url;
      if (!url) {
        logger.warning(`No URL found for item ${item.id}`);
        return;
      }
      const metadata = metadataResults.get(url);
      if (!metadata) {
        logger.warning(`No metadata found for item ${item.id} with URL ${url}`);
        return;
      }
      await updateItemWithMetadata(item.id, metadata);
    },
    {
      batchSize: BATCH_SIZE,
      delayMs: BATCH_DELAY_MS,
      logItemName: "items",
    }
  );

  logger.success(`Updated ${itemsWithMissingMetadata.length} items with metadata using batched processing`);
}

/**
 * Prepare board data by extracting metadata for items that need it
 */
async function prepareBoardData(): Promise<void> {
  await updateItemsWithUrlsInNames();
  await updateItemsWithMissingMetadata();
}

async function getBoardItems(): Promise<SourceBoardItem[]> {
  const config = createConfigFromEnvironment();
  await validateBoardAccess(config.boardId);
  const apiClient = getMondayApiClient();

  logger.info(`Fetching board items from board ${config.boardId}`);

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

  const items = parseBoardItems(response);
  if (items.length === LIMIT) {
    throw new Error(
      `Retrieved ${items.length} items from Monday board, which is the limit of ${LIMIT} items. This means we need to implement pagination.
Another options is to query only non-done items.`
    );
  }
  logger.success(`Retrieved ${items.length} items from Monday board`);

  return items;
}

/**
 * Fetch podcast candidates from Monday board
 * @param maxItems Maximum number of candidates to fetch (default: 3)
 * @returns Array of article candidates with valid URLs
 */
export async function getPodcastCandidates(maxItems: number = 3): Promise<ArticleCandidate[]> {
  await prepareBoardData();
  const boardItems = await getBoardItems();

  const candidates = findCandidates(boardItems);
  const selectedCandidates = candidates.slice(0, maxItems);

  logger.info(`Found ${candidates.length} podcast candidates, returning top ${selectedCandidates.length}`);

  return selectedCandidates;
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

  logger.success(`Updated item ${itemId} with podcast URL`);
}
