import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { FailureTrackingService } from "./failureTrackingService";
import * as logger from "../logger";

// Mock file system operations
vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock logger
vi.mock("../logger", () => ({
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

// Test helpers
const createMockLogData = (
  entries: Array<{ timestamp: string; url: string; itemId: string; errorMessage: string }>
) => ({
  entries,
});

const createTimestamp = (daysAgo: number): string => {
  const time = new Date();
  time.setDate(time.getDate() - daysAgo);
  return time.toISOString();
};

describe("FailureTrackingService", () => {
  let service: FailureTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FailureTrackingService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("recordFailure", () => {
    it("should record a new failure entry", async () => {
      const url = "https://example.com/article";
      const itemId = "item-123";
      const errorMessage = "Generation failed";

      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: "ENOENT" });
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory doesn't exist"));

      await service.recordFailure(url, itemId, errorMessage);

      expect(logger.info).toHaveBeenCalledWith(`Recording generation failure for URL: ${url}`);

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith("logs", { recursive: true });

      // Verify file write
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join("logs", "generation-failures.json"),
        expect.stringContaining(url),
        "utf-8"
      );

      // Verify entry content
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.entries).toHaveLength(1);
      expect(writtenData.entries[0].url).toBe(url);
      expect(writtenData.entries[0].itemId).toBe(itemId);
      expect(writtenData.entries[0].errorMessage).toBe(errorMessage);
    });

    it("should append to existing log file", async () => {
      const existingLog = createMockLogData([
        {
          timestamp: createTimestamp(1),
          url: "https://example.com/old",
          itemId: "old-item",
          errorMessage: "Old error",
        },
      ]);
      const url = "https://example.com/new";

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingLog));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await service.recordFailure(url, "new-item", "New error");

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.entries).toHaveLength(2);
      expect(writtenData.entries[1].url).toBe(url);
    });

    it("should cleanup old entries when recording new ones", async () => {
      const existingLog = createMockLogData([
        {
          timestamp: createTimestamp(31),
          url: "https://example.com/old",
          itemId: "old-item",
          errorMessage: "Old error",
        },
        {
          timestamp: createTimestamp(5),
          url: "https://example.com/recent",
          itemId: "recent-item",
          errorMessage: "Recent error",
        },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingLog));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await service.recordFailure("https://example.com/new", "new-item", "New error");

      expect(logger.info).toHaveBeenCalledWith("Cleaned up 1 old failure entries (older than 30 days)");

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.entries).toHaveLength(2); // recent + new, old cleaned up
      expect(writtenData.entries.find((e: any) => e.url === "https://example.com/old")).toBeUndefined();
    });
  });

  describe("getFailureCount", () => {
    it("should return 0 for URL with no failures", async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: "ENOENT" });

      const count = await service.getFailureCount("https://example.com/article");

      expect(count).toBe(0);
    });

    it("should count failures for the same URL", async () => {
      const mockLog = createMockLogData([
        {
          timestamp: createTimestamp(1),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 1",
        },
        {
          timestamp: createTimestamp(2),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 2",
        },
        { timestamp: createTimestamp(3), url: "https://example.com/other", itemId: "item-2", errorMessage: "Error 3" },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockLog));

      const count = await service.getFailureCount("https://example.com/article");

      expect(count).toBe(2);
    });
  });

  describe("shouldMarkAsNonPodcastable", () => {
    it("should return false when failure count is below threshold", async () => {
      const mockLog = createMockLogData([
        {
          timestamp: createTimestamp(1),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 1",
        },
        {
          timestamp: createTimestamp(2),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 2",
        },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockLog));

      const shouldMark = await service.shouldMarkAsNonPodcastable("https://example.com/article");

      expect(shouldMark).toBe(false);
      expect(logger.warning).not.toHaveBeenCalled();
    });

    it("should return true when failure count reaches threshold", async () => {
      const mockLog = createMockLogData([
        {
          timestamp: createTimestamp(1),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 1",
        },
        {
          timestamp: createTimestamp(2),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 2",
        },
        {
          timestamp: createTimestamp(3),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 3",
        },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockLog));

      const shouldMark = await service.shouldMarkAsNonPodcastable("https://example.com/article");

      expect(shouldMark).toBe(true);
      expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining("URL has failed 3 times"));
    });

    it("should return true when failure count exceeds threshold", async () => {
      const mockLog = createMockLogData([
        {
          timestamp: createTimestamp(1),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 1",
        },
        {
          timestamp: createTimestamp(2),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 2",
        },
        {
          timestamp: createTimestamp(3),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 3",
        },
        {
          timestamp: createTimestamp(4),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 4",
        },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockLog));

      const shouldMark = await service.shouldMarkAsNonPodcastable("https://example.com/article");

      expect(shouldMark).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle file read errors other than ENOENT", async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("Permission denied"));

      await expect(service.getFailureCount("https://example.com")).rejects.toThrow(
        "Failed to read failure log: Error: Permission denied"
      );
    });

    it("should handle file write errors", async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: "ENOENT" });
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory doesn't exist"));
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Disk full"));

      await expect(service.recordFailure("https://example.com", "item-1", "Error")).rejects.toThrow(
        "Failed to write failure log: Error: Disk full"
      );
    });

    it("should handle corrupted JSON in log file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("invalid json content");

      await expect(service.getFailureCount("https://example.com")).rejects.toThrow("Failed to read failure log:");
    });
  });

  describe("URL tracking", () => {
    it("should track by URL not by itemId", async () => {
      const mockLog = createMockLogData([
        {
          timestamp: createTimestamp(1),
          url: "https://example.com/article",
          itemId: "item-1",
          errorMessage: "Error 1",
        },
        {
          timestamp: createTimestamp(2),
          url: "https://example.com/article",
          itemId: "item-2",
          errorMessage: "Error 2",
        },
        {
          timestamp: createTimestamp(3),
          url: "https://example.com/article",
          itemId: "item-3",
          errorMessage: "Error 3",
        },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockLog));

      // Same URL across different items should count together
      const count = await service.getFailureCount("https://example.com/article");
      expect(count).toBe(3);

      const shouldMark = await service.shouldMarkAsNonPodcastable("https://example.com/article");
      expect(shouldMark).toBe(true);
    });
  });
});
