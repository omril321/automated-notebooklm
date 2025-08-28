import { GetBoardItemsOpQuery, LinkValue } from "@mondaydotcomorg/api";
import * as logger from "../logger";
import { getMondayApiClient } from "./api-client";
import { REQUIRED_COLUMNS } from "./config";
import { ArticleMetadata, SourceBoardItem } from "./types";
import { safeJsonParse } from "../utils";

export async function getBoardItems({
  boardId,
  excludedGroups,
}: {
  boardId: string;
  excludedGroups: readonly string[];
}): Promise<SourceBoardItem[]> {
  const apiClient = getMondayApiClient();

  logger.info(`Fetching board items from board ${boardId}, excluding group IDs: ${excludedGroups.join(", ")}`);

  const LIMIT = 500;
  const query = `
  query GetBoardItems($boardId: [ID!]) {
    boards(ids: $boardId) {
      items_page(limit: ${LIMIT}, query_params: {rules: [{column_id: "group", compare_value: ${JSON.stringify(
    excludedGroups
  )}, operator: not_any_of}]}) {
        items {
          id
          name
          group {
            id
            title
          }
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
  const response = await apiClient.request<GetBoardItemsOpQuery>(query, { boardId: [boardId] });

  const items = parseBoardItems(response);

  if (items.length === LIMIT) {
    throw new Error(
      `Retrieved ${items.length} items from Monday board, which is the limit of ${LIMIT} items. This means we need to implement pagination.`
    );
  }
  logger.success(
    `Retrieved ${items.length} items from Monday board (excluded group IDs: ${excludedGroups.join(", ")})`
  );

  return items;
}

function parseBoardItems(items: GetBoardItemsOpQuery): SourceBoardItem[] {
  if (!items.boards?.[0]?.items_page?.items) {
    throw new Error("Unexpected response from Monday API - no items found");
  }

  return items.boards[0].items_page.items.map((item) => {
    const rawSourceUrl = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.sourceUrl.id)?.value;
    const rawFittingForPodcast = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.podcastFitness.id);
    const fitnessDisplay = (rawFittingForPodcast as { display_value?: string } | undefined)?.display_value ?? "0";
    const rawMetadata = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.metadata.id)?.value;
    const metadata = safeJsonParse<ArticleMetadata>(rawMetadata);
    const type = (item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.type.id) as undefined | { text: string })
      ?.text;
    const rawNonPodcastable = item.column_values.find((cv) => cv.id === REQUIRED_COLUMNS.nonPodcastable.id)?.value;
    const nonPodcastableObj = safeJsonParse<{ checked?: string }>(rawNonPodcastable);
    const nonPodcastable = nonPodcastableObj?.checked ? nonPodcastableObj.checked === "true" : null;

    const sourceUrlValue = parseSourceUrl(rawSourceUrl);

    return {
      id: item.id,
      name: item.name,
      sourceUrlValue,
      podcastFitness: Number(fitnessDisplay),
      metadata,
      nonPodcastable,
      type,
      group: (item as any).group ? { id: (item as any).group.id, title: (item as any).group.title } : null,
    };
  });
}

function parseSourceUrl(sourceUrlRaw: string): LinkValue | undefined {
  try {
    return JSON.parse(sourceUrlRaw) as LinkValue;
  } catch (error) {
    return undefined;
  }
}
