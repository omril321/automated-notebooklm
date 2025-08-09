import { describe, it, expect, beforeAll, afterEach, beforeEach, vi } from "vitest";
import { promises as fs } from "fs";
import {
  createTestOutputDir,
  cleanupTestOutputDir,
  getTestFixturePath,
  getTestOutputPath,
  generateTestFilename,
  validateFileExists,
  checkFfmpegAvailable,
} from "./utils/test-helpers";

import { convertToMp3 } from "../audioConversionService";
import { GeneratedPodcast } from "../types";
import { ArticleMetadata } from "../monday/types";
import path from "path";

const TEST_FIXTURE_FILE = "real NLM's output_for test.wav";

function createTestMetadata(title: string): ArticleMetadata {
  return {
    title,
    description: "Test Description",
    contentType: "Article",
    isNonPodcastable: false,
    codeContentPercentage: 0,
    totalTextLength: 1000,
  };
}

describe("audioConversionService", () => {
  beforeAll(async () => {
    const ffmpegAvailable = checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error("FFmpeg is not available. Please install FFmpeg to run audio conversion tests.");
    }
  });

  beforeEach(async () => await createTestOutputDir());
  afterEach(async () => await cleanupTestOutputDir());

  describe("convertToMp3", () => {
    it("should require a valid WAV file path", async () => {
      const podcast: GeneratedPodcast = {
        stage: "generated",
        metadata: createTestMetadata("Test Podcast"),
        notebookLmDetails: {
          title: "Test Podcast",
          description: "Test Description",
        },
        sourceUrls: ["https://example.com"],
        wavPath: "nonexistent.wav",
      };

      const options = {
        outputPath: getTestOutputPath("output.mp3"),
      };

      await expect(convertToMp3(podcast, options)).rejects.toThrow();
    });

    it("should create single output file", async () => {
      const outputPath = getTestOutputPath(generateTestFilename("title-test", "mp3"));
      const inputPath = getTestFixturePath(TEST_FIXTURE_FILE);

      const podcast: GeneratedPodcast = {
        stage: "generated",
        metadata: createTestMetadata("Test Podcast"),
        notebookLmDetails: {
          title: "Test Podcast",
          description: "Test Description",
        },
        sourceUrls: ["https://example.com"],
        wavPath: inputPath,
      };

      const options = {
        outputPath,
      };

      const result = await convertToMp3(podcast, options);

      expect(result.mp3Path).toBe(outputPath);
      expect(await validateFileExists(outputPath)).toBe(true);

      // Check that only ONE file was created at the expected path
      const files = await fs.readdir(path.dirname(outputPath));
      const mp3Files = files.filter((f) => f.endsWith(".mp3"));

      expect(mp3Files).toHaveLength(1);
      expect(mp3Files[0]).toMatch(/title-test-\d+\.mp3/);
    });

    it("should handle conversion options correctly", async () => {
      const outputPath = getTestOutputPath(generateTestFilename("custom-options", "mp3"));
      const inputPath = getTestFixturePath(TEST_FIXTURE_FILE);

      const podcast: GeneratedPodcast = {
        stage: "generated",
        metadata: createTestMetadata("Custom Options Test"),
        notebookLmDetails: {
          title: "Custom Options Test",
          description: "Test Description",
        },
        sourceUrls: ["https://example.com"],
        wavPath: inputPath,
      };

      const options = {
        outputPath,
        bitrate: "256k",
        quality: 2,
        sampleRate: 22050,
      };

      const result = await convertToMp3(podcast, options);

      expect(result.mp3Path).toBe(outputPath);
      expect(result.stage).toBe("converted");
      expect(result.metadata.title).toBe("Custom Options Test");
      expect(await validateFileExists(outputPath)).toBe(true);
    });
  });
});
