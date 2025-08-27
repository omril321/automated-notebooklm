import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { createConfigFromEnvironment } from "./config";
import { MondayError, MondayErrorType } from "./errors";

describe("Monday.com Configuration Service", () => {
  let originalEnv = process.env;
  beforeAll(() => {
    originalEnv = process.env;
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Ensure required env var for success-path tests
    process.env.MONDAY_EXCLUDED_GROUP_IDS = "group_done,group_archive";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("createConfigFromEnvironment", () => {
    it("should create valid config with all required environment variables", () => {
      process.env.MONDAY_API_TOKEN = "test-api-token";
      process.env.MONDAY_BOARD_URL = "https://company.monday.com/boards/123456789";

      const config = createConfigFromEnvironment();

      expect(config).toEqual({
        apiToken: "test-api-token",
        boardUrl: "https://company.monday.com/boards/123456789",
        boardId: "123456789",
        excludedGroups: ["group_done", "group_archive"],
      });
    });

    it("should support board URLs with views", () => {
      process.env.MONDAY_API_TOKEN = "test-token";
      process.env.MONDAY_BOARD_URL = "https://omril321.monday.com/boards/3549832241/views/206723838";

      const config = createConfigFromEnvironment();

      expect(config.boardId).toBe("3549832241");
      expect(config.boardUrl).toBe("https://omril321.monday.com/boards/3549832241/views/206723838");
      expect(config.excludedGroups).toEqual(["group_done", "group_archive"]);
    });

    it("should support board URLs with other paths", () => {
      process.env.MONDAY_API_TOKEN = "test-token";
      process.env.MONDAY_BOARD_URL = "https://company.monday.com/boards/987654321/pulses/item123";

      const config = createConfigFromEnvironment();

      expect(config.boardId).toBe("987654321");
      expect(config.excludedGroups).toEqual(["group_done", "group_archive"]);
    });

    it("should throw MondayError when MONDAY_API_TOKEN is missing", () => {
      delete process.env.MONDAY_API_TOKEN;
      process.env.MONDAY_BOARD_URL = "https://company.monday.com/boards/123456789";

      expect(() => createConfigFromEnvironment()).toThrow(MondayError);
      expect(() => createConfigFromEnvironment()).toThrow("MONDAY_API_TOKEN environment variable is required");

      try {
        createConfigFromEnvironment();
      } catch (error) {
        expect(error).toBeInstanceOf(MondayError);
        expect((error as MondayError).type).toBe(MondayErrorType.INVALID_CONFIG);
      }
    });

    it("should throw MondayError when MONDAY_BOARD_URL is missing", () => {
      process.env.MONDAY_API_TOKEN = "test-token";
      delete process.env.MONDAY_BOARD_URL;

      expect(() => createConfigFromEnvironment()).toThrow(MondayError);
      expect(() => createConfigFromEnvironment()).toThrow("MONDAY_BOARD_URL environment variable is required");
    });

    it("should throw MondayError for invalid board URL format", () => {
      process.env.MONDAY_API_TOKEN = "test-token";
      process.env.MONDAY_BOARD_URL = "https://invalid-url.com";

      expect(() => createConfigFromEnvironment()).toThrow(MondayError);
      expect(() => createConfigFromEnvironment()).toThrow("Invalid Monday.com board URL format");

      try {
        createConfigFromEnvironment();
      } catch (error) {
        expect((error as MondayError).type).toBe(MondayErrorType.INVALID_CONFIG);
      }
    });

    it("should throw MondayError for URL without board ID", () => {
      process.env.MONDAY_API_TOKEN = "test-token";
      process.env.MONDAY_BOARD_URL = "https://company.monday.com/boards/";

      expect(() => createConfigFromEnvironment()).toThrow(MondayError);
    });

    it("should throw MondayError for non-Monday.com URLs", () => {
      process.env.MONDAY_API_TOKEN = "test-token";
      process.env.MONDAY_BOARD_URL = "https://trello.com/boards/123456789";

      expect(() => createConfigFromEnvironment()).toThrow(MondayError);
    });
  });
});
