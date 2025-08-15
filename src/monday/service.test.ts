import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPodcastCandidates, updateItemWithGeneratedPodcastUrl, constructMondayItemUrl } from "./service";
import * as logger from "../logger";

// Mock the logger
vi.mock("../logger", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

// Mock the dependencies
vi.mock("./config", () => ({
  createConfigFromEnvironment: () => ({
    apiToken: "test-token",
    boardId: "test-board-id",
  }),
  REQUIRED_COLUMNS: {
    sourceUrl: { id: "source_url" },
    podcastFitness: { id: "podcast_fitness" },
    metadata: { id: "metadata" },
    nonPodcastable: { id: "non_podcastable" },
    type: { id: "type" },
    podcastLink: { id: "podcast_link" },
  },
}));

const mockApiClient = {
  operations: {
    changeMultipleColumnValuesOp: vi.fn().mockResolvedValue({}),
    changeColumnValueOp: vi.fn().mockResolvedValue({}),
  },
  request: vi.fn(),
};

vi.mock("./api-client", () => ({
  getMondayApiClient: vi.fn(() => mockApiClient),
}));

vi.mock("./board-validator", () => ({
  validateBoardAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/articleMetadataService", () => ({
  extractMetadataBatch: vi.fn().mockResolvedValue(new Map()),
}));

// Mock config to test URL construction
vi.mock("./config", () => ({
  createConfigFromEnvironment: vi.fn(() => ({
    apiToken: "test-token",
    boardId: "test-board-id",
    boardUrl: "https://omril321.monday.com/boards/3549832241/views/206723838",
  })),
  REQUIRED_COLUMNS: {
    sourceUrl: { id: "source_url" },
    podcastFitness: { id: "podcast_fitness" },
    metadata: { id: "metadata" },
    nonPodcastable: { id: "non_podcastable" },
    type: { id: "type" },
    podcastLink: { id: "podcast_link" },
  },
}));

describe("Monday Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Set up default mock response for API calls
    mockApiClient.request.mockResolvedValue({
      boards: [
        {
          items_page: {
            items: [
              {
                id: "default-item",
                name: "Default Article",
                column_values: [
                  { id: "source_url", value: '{"url": "https://example.com/default", "text": "Default"}' },
                  { id: "podcast_fitness", display_value: "5" },
                  { id: "type", text: "Article" },
                  {
                    id: "metadata",
                    value: '{"title": "Default", "contentType": "Article", "isNonPodcastable": false}',
                  },
                  { id: "non_podcastable", value: null },
                ],
              },
            ],
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPodcastCandidates", () => {
    it("should return empty array when no valid candidates found", async () => {
      // Override default mock to have items with 0 podcast fitness
      mockApiClient.request.mockResolvedValue({
        boards: [
          {
            items_page: {
              items: [
                {
                  id: "item1",
                  name: "Article 1",
                  column_values: [
                    { id: "source_url", value: '{"url": "https://example.com/article1", "text": "Article 1"}' },
                    { id: "podcast_fitness", display_value: "0" }, // No fitness
                    { id: "type", text: "Article" },
                    {
                      id: "metadata",
                      value: '{"title": "Article 1", "contentType": "Article", "isNonPodcastable": false}',
                    },
                    { id: "non_podcastable", value: null },
                  ],
                },
              ],
            },
          },
        ],
      });

      const result = await getPodcastCandidates();

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith("Found 0 podcast candidates, returning top 0");
    });

    it("should return top candidates with valid URLs and podcast fitness", async () => {
      // Override default mock to have items with good podcast fitness
      mockApiClient.request.mockResolvedValue({
        boards: [
          {
            items_page: {
              items: [
                {
                  id: "item1",
                  name: "Article 1",
                  column_values: [
                    { id: "source_url", value: '{"url": "https://example.com/article1", "text": "Article 1"}' },
                    { id: "podcast_fitness", display_value: "8" },
                    { id: "type", text: "Article" },
                    {
                      id: "metadata",
                      value: '{"title": "Article 1", "contentType": "Article", "isNonPodcastable": false}',
                    },
                    { id: "non_podcastable", value: null },
                  ],
                },
                {
                  id: "item2",
                  name: "Article 2",
                  column_values: [
                    { id: "source_url", value: '{"url": "https://example.com/article2", "text": "Article 2"}' },
                    { id: "podcast_fitness", display_value: "9" },
                    { id: "type", text: "Article" },
                    {
                      id: "metadata",
                      value:
                        '{"title": "Article 2", "contentType": "Article", "isNonPodcastable": false, "codeContentPercentage": 10, "totalTextLength": 1000}',
                    },
                    { id: "non_podcastable", value: null },
                  ],
                },
              ],
            },
          },
        ],
      });

      const result = await getPodcastCandidates(2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "item2",
        name: "Article 2",
        sourceUrl: "https://example.com/article2",
        metadata: {
          title: "Article 2",
          contentType: "Article",
          isNonPodcastable: false,
          codeContentPercentage: 10,
          totalTextLength: 1000,
        },
      });
      expect(result[1]).toEqual({
        id: "item1",
        name: "Article 1",
        sourceUrl: "https://example.com/article1",
        metadata: {
          title: "Article 1",
          contentType: "Article",
          isNonPodcastable: false,
        },
      });
    });

    it("should process items in batches when updating metadata", async () => {
      // Mock items that need metadata extraction - URLs in names
      mockApiClient.request.mockResolvedValue({
        boards: [
          {
            items_page: {
              items: [
                {
                  id: "item1",
                  name: "https://example.com/article1",
                  column_values: [
                    { id: "source_url", value: null },
                    { id: "podcast_fitness", display_value: "0" },
                    { id: "type", text: "Article" }, // Needs to be Article type
                    { id: "metadata", value: null },
                    { id: "non_podcastable", value: null },
                  ],
                },
              ],
            },
          },
        ],
      });

      // Mock metadata extraction
      const { extractMetadataBatch } = await import("../services/articleMetadataService");
      vi.mocked(extractMetadataBatch).mockResolvedValue(
        new Map([
          [
            "https://example.com/article1",
            {
              title: "Extracted Title",
              contentType: "Article",
              isNonPodcastable: false,
              description: "",
              codeContentPercentage: 0,
              totalTextLength: 0,
            },
          ],
        ])
      );

      await getPodcastCandidates();

      // Verify batching logs were used
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Processing batch 1/1"));
    });
  });

  describe("updateItemWithGeneratedPodcastUrl", () => {
    it("should update item with podcast URL", async () => {
      const itemId = "test-item-id";
      const podcastUrl = "https://example.com/podcast.mp3";

      await updateItemWithGeneratedPodcastUrl(itemId, podcastUrl);

      expect(mockApiClient.operations.changeColumnValueOp).toHaveBeenCalledWith({
        boardId: "test-board-id",
        itemId,
        columnId: "podcast_link",
        value: `"${podcastUrl}"`,
      });

      expect(logger.success).toHaveBeenCalledWith(`Updated item ${itemId} with podcast URL`);
    });

    it("should validate board access before updating", async () => {
      const itemId = "test-item-id";
      const podcastUrl = "https://example.com/podcast.mp3";

      await updateItemWithGeneratedPodcastUrl(itemId, podcastUrl);

      const { validateBoardAccess } = await import("./board-validator");
      expect(validateBoardAccess).toHaveBeenCalledWith("test-board-id");
    });
  });

  describe("constructMondayItemUrl", () => {
    it("should construct valid Monday item URL", () => {
      const itemId = "9783190631";
      const result = constructMondayItemUrl(itemId);

      expect(result).toBe("https://omril321.monday.com/boards/3549832241/pulses/9783190631");
    });

    it("should throw error for invalid board URL format", async () => {
      // Mock invalid config
      const { createConfigFromEnvironment } = vi.mocked(await import("./config"));
      createConfigFromEnvironment.mockReturnValueOnce({
        apiToken: "test-token",
        boardId: "test-board-id",
        boardUrl: "invalid-url",
        excludedGroups: [],
      });

      expect(() => constructMondayItemUrl("123")).toThrow("Invalid board URL format");
    });
  });
});
