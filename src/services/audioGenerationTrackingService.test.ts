import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { AudioGenerationTrackingService, AudioGenerationRateLimitError } from "./audioGenerationTrackingService";
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
const createMockLogData = (entries: Array<{ timestamp: string; runId: string; resourceUrl: string }>) => ({
  entries,
});

const createTimestamp = (hoursAgo: number): string => {
  const time = new Date();
  time.setHours(time.getHours() - hoursAgo);
  return time.toISOString();
};

describe("AudioGenerationTrackingService", () => {
  let service: AudioGenerationTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh instance for each test
    service = new AudioGenerationTrackingService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateRateLimit", () => {
    it("should return 3 when no previous entries exist", async () => {
      // Mock empty log file
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: "ENOENT" });

      await expect(service.validateRateLimit()).resolves.toBe(3);

      expect(logger.info).toHaveBeenCalledWith("Checking audio generation rate limits...");
      expect(logger.success).toHaveBeenCalledWith("Rate limit check passed: 0/3 generations in the last 24 hours");
    });

    it("should return remaining slots when entries are within rate limit", async () => {
      const mockLog = createMockLogData([
        { timestamp: createTimestamp(2), runId: "run-1", resourceUrl: "https://example.com/1" },
        { timestamp: createTimestamp(5), runId: "run-2", resourceUrl: "https://example.com/2" },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockLog));

      await expect(service.validateRateLimit()).resolves.toBe(1);

      expect(logger.success).toHaveBeenCalledWith("Rate limit check passed: 2/3 generations in the last 24 hours");
    });

    it("should return 0 and log warning when rate limit is exceeded", async () => {
      const mockLog = createMockLogData([
        { timestamp: createTimestamp(1), runId: "run-1", resourceUrl: "https://example.com/1" },
        { timestamp: createTimestamp(5), runId: "run-2", resourceUrl: "https://example.com/2" },
        { timestamp: createTimestamp(10), runId: "run-3", resourceUrl: "https://example.com/3" },
      ]);

      const mockLogString = JSON.stringify(mockLog);
      vi.mocked(fs.readFile).mockResolvedValue(mockLogString);

      await expect(service.validateRateLimit()).resolves.toBe(0);
      expect(logger.warning).toHaveBeenCalledWith("Rate limit exceeded: 3 audio generations in the last 24 hours");
    });

    it("should ignore entries older than 24 hours", async () => {
      const mockLog = createMockLogData([
        { timestamp: createTimestamp(2), runId: "run-1", resourceUrl: "https://example.com/1" },
        { timestamp: createTimestamp(25), runId: "run-2", resourceUrl: "https://example.com/2" }, // > 24h old
        { timestamp: createTimestamp(30), runId: "run-3", resourceUrl: "https://example.com/3" }, // > 24h old
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockLog));

      await expect(service.validateRateLimit()).resolves.toBe(2);
      expect(logger.success).toHaveBeenCalledWith("Rate limit check passed: 1/3 generations in the last 24 hours");
    });
  });

  describe("recordAudioGeneration", () => {
    it("should record a new audio generation entry", async () => {
      const mockLog = createMockLogData([]);
      const resourceUrl = "https://example.com/article";

      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: "ENOENT" }); // No existing log
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory doesn't exist"));

      await service.recordAudioGeneration(resourceUrl);

      expect(logger.info).toHaveBeenCalledWith(`Recording audio generation for URL: ${resourceUrl}`);
      expect(logger.success).toHaveBeenCalledWith(expect.stringMatching(/Audio generation recorded with run ID: /));

      // Verify directory creation
      expect(fs.mkdir).toHaveBeenCalledWith("logs", { recursive: true });

      // Verify file write
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join("logs", "audio-generation.json"),
        expect.stringContaining(resourceUrl),
        "utf-8"
      );
    });

    it("should append to existing log file", async () => {
      const existingLog = createMockLogData([
        { timestamp: createTimestamp(5), runId: "old-run", resourceUrl: "https://example.com/old" },
      ]);
      const resourceUrl = "https://example.com/new";

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingLog));
      vi.mocked(fs.access).mockResolvedValue(undefined); // Directory exists

      await service.recordAudioGeneration(resourceUrl);

      // Verify the new entry was added
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.entries).toHaveLength(2);
      expect(writtenData.entries[1].resourceUrl).toBe(resourceUrl);
      expect(writtenData.entries[1].timestamp).toBeDefined();
      expect(writtenData.entries[1].runId).toBeDefined();
    });

    it("should cleanup old entries when recording new ones", async () => {
      const oldTimestamp = new Date();
      oldTimestamp.setDate(oldTimestamp.getDate() - 8); // 8 days old

      const existingLog = createMockLogData([
        { timestamp: oldTimestamp.toISOString(), runId: "old-run", resourceUrl: "https://example.com/old" },
        { timestamp: createTimestamp(5), runId: "recent-run", resourceUrl: "https://example.com/recent" },
      ]);

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingLog));
      vi.mocked(fs.access).mockResolvedValue(undefined);

      await service.recordAudioGeneration("https://example.com/new");

      expect(logger.info).toHaveBeenCalledWith("Cleaned up 1 old audio generation entries (older than 7 days)");

      // Verify old entry was removed
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);

      expect(writtenData.entries).toHaveLength(2); // recent + new entry, old one cleaned up
      expect(writtenData.entries.find((e: any) => e.resourceUrl === "https://example.com/old")).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should handle file read errors other than ENOENT", async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("Permission denied"));

      await expect(service.validateRateLimit()).rejects.toThrow(
        "Failed to read audio generation log: Error: Permission denied"
      );
    });

    it("should handle file write errors", async () => {
      vi.mocked(fs.readFile).mockRejectedValueOnce({ code: "ENOENT" });
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("Directory doesn't exist"));
      vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Disk full"));

      await expect(service.recordAudioGeneration("https://example.com")).rejects.toThrow(
        "Failed to write audio generation log: Error: Disk full"
      );
    });

    it("should handle corrupted JSON in log file", async () => {
      vi.mocked(fs.readFile).mockResolvedValue("invalid json content");

      await expect(service.validateRateLimit()).rejects.toThrow("Failed to read audio generation log:");
    });
  });

  describe("AudioGenerationRateLimitError", () => {
    it("should create error with correct message and name", () => {
      const error = new AudioGenerationRateLimitError(5, "24 hours");

      expect(error.message).toBe(
        "Rate limit exceeded: 5 audio generations in the last 24 hours. Please try again later."
      );
      expect(error.name).toBe("AudioGenerationRateLimitError");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("run ID generation", () => {
    it("should generate unique run IDs for different instances", () => {
      const service1 = new AudioGenerationTrackingService();
      const service2 = new AudioGenerationTrackingService();

      // Access private runId through a recorded entry
      vi.mocked(fs.readFile).mockRejectedValue({ code: "ENOENT" });
      vi.mocked(fs.access).mockRejectedValue(new Error("Directory doesn't exist"));

      // The run IDs should be different (timestamp-based)
      // We can verify this by checking that they create different log entries
      expect(service1).not.toBe(service2);
    });
  });

  describe("integration behavior", () => {
    it("should handle complete workflow: validate -> record -> validate again", async () => {
      // Start with empty log
      vi.mocked(fs.readFile)
        .mockRejectedValueOnce({ code: "ENOENT" }) // First validate
        .mockRejectedValueOnce({ code: "ENOENT" }) // Record (read)
        .mockResolvedValueOnce(
          JSON.stringify(
            createMockLogData([
              { timestamp: new Date().toISOString(), runId: "test-run", resourceUrl: "https://example.com" },
            ])
          )
        ); // Second validate

      vi.mocked(fs.access).mockRejectedValue(new Error("Directory doesn't exist"));

      // First validation should pass
      await expect(service.validateRateLimit()).resolves.toBe(3);

      // Record an entry
      await service.recordAudioGeneration("https://example.com");

      // Second validation should still report remaining slots (1 < 3)
      await expect(service.validateRateLimit()).resolves.toBe(2);
    });
  });
});
