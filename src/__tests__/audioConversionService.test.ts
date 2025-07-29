import { describe, it, expect, beforeAll, afterEach, beforeEach, Mocked, vi } from "vitest";
import { promises as fs } from "fs";
import type { Download } from "playwright";
import {
  createTestOutputDir,
  cleanupTestOutputDir,
  getTestFixturePath,
  getTestOutputPath,
  generateTestFilename,
  validateFileExists,
  checkFfmpegAvailable,
} from "./utils/test-helpers";

import { convertFromDownload } from "../audioConversionService";
import path from "path";

const TEST_FIXTURE_FILE = "real NLM's output_for test.wav";

function createMockDownload(filename: string = "test.wav"): Partial<Mocked<Download>> {
  return {
    suggestedFilename: vi.fn().mockReturnValue(filename),
    saveAs: vi.fn().mockImplementation(async (path: string) => {
      const fixturePath = getTestFixturePath(TEST_FIXTURE_FILE);
      const fixtureContent = await fs.readFile(fixturePath);
      await fs.writeFile(path, fixtureContent);
    }),
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

  describe("convertFromDownload", () => {
    it("should require a valid Download object", async () => {
      const options = {
        outputPath: getTestOutputPath("output.mp3"),
      };

      await expect(convertFromDownload(null as any, options)).rejects.toThrow();
    });

    it("should require valid conversion options", async () => {
      const mockDownload = createMockDownload();

      await expect(convertFromDownload(mockDownload as Download, null as any)).rejects.toThrow();
    });

    it("should create single output file", async () => {
      const outputPath = getTestOutputPath(generateTestFilename("title-test", "mp3"));
      const mockDownload = createMockDownload();
      const titleWithSpaces = "Test Audio Title";

      const options = {
        outputPath,
        title: titleWithSpaces,
      };

      const result = await convertFromDownload(mockDownload as Download, options);

      expect(result.outputPath).toBe(outputPath);
      expect(await validateFileExists(outputPath)).toBe(true);

      // Check that only ONE file was created at the expected path

      const files = await fs.readdir(path.dirname(outputPath));
      const mp3Files = files.filter((f) => f.endsWith(".mp3"));

      expect(mp3Files).toHaveLength(1);
      expect(mp3Files[0]).toMatch(/title-test-\d+\.mp3/);
    });

    it("should handle conversion options correctly", async () => {
      const outputPath = getTestOutputPath(generateTestFilename("custom-options", "mp3"));
      const mockDownload = createMockDownload();

      const options = {
        outputPath,
        title: "Custom Test",
        bitrate: "256k",
        quality: 2,
        sampleRate: 22050,
      };

      const result = await convertFromDownload(mockDownload as Download, options);

      expect(result.outputPath).toBe(outputPath);
      expect(result.originalSize).toBe(51037484);
      expect(result.convertedSize).toBe(11009292);
      expect(await validateFileExists(outputPath)).toBe(true);
    });
  });
});
