import { Column, ColumnType } from "@mondaydotcomorg/api";
import { MondayError, MondayErrorType } from "./errors";
import { REQUIRED_COLUMNS } from "./config";
import { getMondayApiClient } from "./api-client";

/**
 * Validate that we can access the Monday.com board
 * Throws MondayError if validation fails
 */
export const validateBoardAccess = async (boardId: string): Promise<void> => {
  const apiClient = getMondayApiClient();

  try {
    const response = await apiClient.operations.getBoardItemsOp({ ids: [boardId] });

    const boards = response.boards || [];
    if (boards.length === 0) {
      throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, `Board ${boardId} not found or no access`);
    }

    const board = boards[0];
    const firstItem = board!.items_page!.items[0];
    validateBoardColumns(firstItem.column_values);
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
const validateBoardColumns = (columns: { id: string; type: ColumnType }[]): void => {
  if (!columns || !Array.isArray(columns)) {
    throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, "Board has no columns available");
  }

  const validColumns = columns.filter((col): col is Column => col !== null && col !== undefined);

  if (validColumns.length === 0) {
    throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, "Board has no valid columns");
  }

  const columnsById = new Map(validColumns.map((col) => [col.id, col]));

  Object.values(REQUIRED_COLUMNS).forEach(({ id, type: expectedType }) => {
    const column = columnsById.get(id);

    if (!column) {
      throw new MondayError(MondayErrorType.BOARD_ACCESS_ERROR, `Required column "${id}" not found in board`);
    }

    if (column.type !== expectedType) {
      throw new MondayError(
        MondayErrorType.BOARD_ACCESS_ERROR,
        `Column "${id}" has incorrect type. Expected: ${expectedType}, Got: ${column.type}`
      );
    }
  });
};
