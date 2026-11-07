import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import {
  createTestOutputDir,
  cleanupTestOutputDir,
  getTestOutputPath,
  generateTestFilename,
  validateFileExists,
} from "./utils/test-helpers";

import { convertToMp3 } from "../audioConversionService";
import { GeneratedPodcast } from "../types";

function createPodcast(audioPath: string, title = "Test Podcast"): GeneratedPodcast {
  return {
    stage: "generated",
    metadata: {
      title,
      description: "Test Description",
      contentType: "Article",
      isNonPodcastable: false,
      codeContentPercentage: 0,
      totalTextLength: 1000,
    },
    notebookLmDetails: { title, description: "Test Description" },
    sourceUrls: ["https://example.com"],
    wavPath: audioPath,
  };
}

describe("audioConversionService", () => {
  beforeEach(async () => await createTestOutputDir());
  afterEach(async () => await cleanupTestOutputDir());

  describe("convertToMp3", () => {
    it("rejects non-MP3 input", async () => {
      const podcast = createPodcast(getTestOutputPath("audio.wav"));

      await expect(convertToMp3(podcast, { outputPath: getTestOutputPath("out.mp3") })).rejects.toThrow(
        "Unsupported audio format"
      );
    });

    it("fails when the MP3 does not exist", async () => {
      const podcast = createPodcast(getTestOutputPath("missing.mp3"));

      await expect(convertToMp3(podcast, { outputPath: getTestOutputPath("out.mp3") })).rejects.toThrow();
    });

    it("copies to outputPath when given", async () => {
      const inputPath = getTestOutputPath(generateTestFilename("input", "mp3"));
      const outputPath = getTestOutputPath(generateTestFilename("output", "mp3"));
      await fs.writeFile(inputPath, "fake mp3 data");

      const result = await convertToMp3(createPodcast(inputPath, "Custom Title"), { outputPath });

      expect(result.stage).toBe("converted");
      expect(result.mp3Path).toBe(outputPath);
      expect(result.metadata.title).toBe("Custom Title");
      expect(await validateFileExists(outputPath)).toBe(true);
    });

    it("copies into outputDir with a title-based filename", async () => {
      const inputPath = getTestOutputPath(generateTestFilename("input", "mp3"));
      await fs.writeFile(inputPath, "fake mp3 data");

      const outputDir = getTestOutputPath("downloads");
      await fs.mkdir(outputDir, { recursive: true });

      const result = await convertToMp3(createPodcast(inputPath, "My Great Title"), { outputDir });

      expect(result.mp3Path).toMatch(/downloads\/My_Great_Title_\d{4}-\d{2}-\d{2}\.mp3$/);
      expect(await validateFileExists(result.mp3Path)).toBe(true);
    });

    it("keeps the input path when no destination is given", async () => {
      const inputPath = getTestOutputPath(generateTestFilename("input", "mp3"));
      await fs.writeFile(inputPath, "fake mp3 data");

      const result = await convertToMp3(createPodcast(inputPath));

      expect(result.mp3Path).toBe(inputPath);
    });
  });
});
