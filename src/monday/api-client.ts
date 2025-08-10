/**
 * Monday.com API Client Service
 * Exports a configured Monday.com API client instance
 */

import { ApiClient } from "@mondaydotcomorg/api";
import { createConfigFromEnvironment } from "./config";

let apiClient: ApiClient | null = null;

/**
 * Get the configured Monday.com API client instance
 */
export const getMondayApiClient = (): ApiClient => {
  if (!apiClient) {
    const config = createConfigFromEnvironment();
    if (!config.apiToken?.trim()) {
      throw new Error("Monday API token is missing. Please set MONDAY_API_TOKEN.");
    }
    apiClient = new ApiClient({ token: config.apiToken });
  }
  return apiClient;
};
