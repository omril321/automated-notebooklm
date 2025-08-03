/**
 * Monday.com Board Validator Service
 * Simple board structure validation - throws errors on failure
 */

import { Board, Column } from "@mondaydotcomorg/api";
import { MondayError, MondayErrorType } from "./errors";
import { getRequiredColumns } from "./config";
import { getMondayApiClient } from "./api-client";

// GraphQL query response type for board validation
type BoardQueryResponse = {
  boards: Board[];
};

/**
 * Validate that we can access the Monday.com board
 * Throws MondayError if validation fails
 */
export const validateBoardAccess = async (boardId: string): Promise<void> => {
  const apiClient = getMondayApiClient();

  const query = `
    query GetBoard($boardId: ID!) {
      boards(ids: [$boardId]) {
        id
        name
        columns {
          id
          title
          type
        }
      }
    }
  `;

  try {
    // Use proper generic typing with ApiClient.request<T>()
    const response = await apiClient.request<BoardQueryResponse>(query, { boardId });

    const boards = response.boards || [];
    if (boards.length === 0) {
      throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, `Board ${boardId} not found or no access`);
    }

    const board = boards[0];
    validateBoardColumns(board.columns);
  } catch (error) {
    if (error instanceof MondayError) {
      throw error;
    }
    throw new MondayError(
      MondayErrorType.API_ERROR,
      `Failed to validate board access: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

/**
 * Validate that required columns exist with correct types
 * Throws MondayError if validation fails
 */
const validateBoardColumns = (columns: Board["columns"]): void => {
  if (!columns || !Array.isArray(columns)) {
    throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, "Board has no columns available");
  }

  // Filter out null columns and create a map
  const validColumns = columns.filter((col): col is Column => col !== null && col !== undefined);

  if (validColumns.length === 0) {
    throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, "Board has no valid columns");
  }

  const requiredColumns = getRequiredColumns();

  const columnMap = new Map(validColumns.map((col) => [col.title, col]));

  Object.values(requiredColumns).forEach(({ title, type: expectedType }) => {
    const column = columnMap.get(title);

    if (!column) {
      throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, `Required column "${title}" not found in board`);
    }

    if (column.type !== expectedType) {
      throw new MondayError(
        MondayErrorType.BOARD_ACCESS_ERROR,
        `Column "${title}" has incorrect type. Expected: ${expectedType}, Got: ${column.type}`
      );
    }
  });
};
