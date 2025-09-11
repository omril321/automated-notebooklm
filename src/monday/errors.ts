/**
 * Monday.com Integration Error Handling
 * Custom error types and error class for Monday.com API integration
 */

export const MondayErrorType = {
  INVALID_CONFIG: "invalid_config",
  BOARD_ACCESS_ERROR: "board_access_error",
  API_ERROR: "api_error",
} as const;

export type MondayErrorType = (typeof MondayErrorType)[keyof typeof MondayErrorType];

export class MondayError extends Error {
  constructor(
    public readonly type: MondayErrorType,
    message: string,
    public readonly metadata?: unknown
  ) {
    super(message);
    this.name = "MondayError";
  }
}
