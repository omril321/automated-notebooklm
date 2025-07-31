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

import { convertFromWavFile } from "../audioConversionService";
import path from "path";

const TEST_FIXTURE_FILE = "real NLM's output_for test.wav";

describe("audioConversionService", () => {
  beforeAll(async () => {
    const ffmpegAvailable = checkFfmpegAvailable();
    if (!ffmpegAvailable) {
      throw new Error("FFmpeg is not available. Please install FFmpeg to run audio conversion tests.");
    }
  });

  beforeEach(async () => await createTestOutputDir());
  afterEach(async () => await cleanupTestOutputDir());

  describe("convertFromWavFile", () => {
    it("should require a valid WAV file path", async () => {
      const options = {
        outputPath: getTestOutputPath("output.mp3"),
      };

      await expect(convertFromWavFile("nonexistent.wav", options)).rejects.toThrow();
    });

    it("should require valid conversion options", async () => {
      const inputPath = getTestFixturePath(TEST_FIXTURE_FILE);

      await expect(convertFromWavFile(inputPath, null as any)).rejects.toThrow();
    });

    it("should create single output file", async () => {
      const outputPath = getTestOutputPath(generateTestFilename("title-test", "mp3"));
      const inputPath = getTestFixturePath(TEST_FIXTURE_FILE);

      const options = {
        outputPath,
      };

      const result = await convertFromWavFile(inputPath, options);

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
      const inputPath = getTestFixturePath(TEST_FIXTURE_FILE);

      const options = {
        outputPath,
        bitrate: "256k",
        quality: 2,
        sampleRate: 22050,
      };

      const result = await convertFromWavFile(inputPath, options);

      expect(result.outputPath).toBe(outputPath);
      expect(result.originalSize).toBe(51037484);
      expect(result.convertedSize).toBe(11009292);
      expect(await validateFileExists(outputPath)).toBe(true);
    });
  });
});
