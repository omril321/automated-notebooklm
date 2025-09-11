import { GetBoardItemsOpQuery, LinkValue } from "@mondaydotcomorg/api";
import * as logger from "../logger";
import { getMondayApiClient } from "./api-client";
import { REQUIRED_COLUMNS } from "./config";
import { ArticleMetadata, SourceBoardItem } from "./types";
import { safeJsonParse } from "../utils";
import { MondayError, MondayErrorType } from "./errors";

type ColumnIdDescriptor = { id: string };
type ColumnValue = { id: string; value?: string | null; text?: string | null } & Partial<{ display_value: string }>;

const findColumn = (columnValues: ReadonlyArray<ColumnValue>, column: ColumnIdDescriptor): ColumnValue | undefined => {
  return columnValues.find((cv) => cv.id === column.id);
};

const findColumnRawValue = (
  columnValues: ReadonlyArray<ColumnValue>,
  column: ColumnIdDescriptor
): string | undefined => {
  const match = findColumn(columnValues, column);
  if (!match) {
    throw new MondayError(MondayErrorType.API_ERROR, `Column ${column.id} not found in item`);
  }
  const { value } = match;
  return typeof value === "string" && value.trim() ? value : undefined;
};

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
    const columnValues = item.column_values as ReadonlyArray<ColumnValue>;

    const podcastFitnessCol = findColumn(columnValues, REQUIRED_COLUMNS.podcastFitness);
    const fitnessDisplay = podcastFitnessCol?.display_value ?? "0";

    const rawMetadata = findColumnRawValue(columnValues, REQUIRED_COLUMNS.metadata);
    const metadata = safeJsonParse<ArticleMetadata>(rawMetadata);

    const rawNonPodcastable = findColumn(columnValues, REQUIRED_COLUMNS.nonPodcastable)?.value;
    const nonPodcastableObj = safeJsonParse<{ checked?: string }>(rawNonPodcastable);
    const nonPodcastable = nonPodcastableObj?.checked ? nonPodcastableObj.checked === "true" : null;

    const rawSourceUrl = findColumnRawValue(columnValues, REQUIRED_COLUMNS.sourceUrl);
    const sourceUrlValue = parseSourceUrl(rawSourceUrl!);

    const generatedAudioCol = findColumn(columnValues, REQUIRED_COLUMNS.notebookLmWithGeneratedAudio);
    const generatedAudioLink = generatedAudioCol?.value ? parseSourceUrl(generatedAudioCol.value) : undefined;

    const type = findColumn(columnValues, REQUIRED_COLUMNS.type)?.text ?? undefined;
    return {
      id: item.id,
      name: item.name,
      sourceUrlValue,
      podcastFitness: Number(fitnessDisplay),
      metadata,
      nonPodcastable,
      type,
      generatedAudioLink,
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
