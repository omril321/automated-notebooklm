import { promises as fs } from "fs";
import { success } from "./logger";
import { GeneratedPodcast, ConvertedPodcast, toConvertedPodcast } from "./types";
import { generateOutputPath } from "./downloadUtils";

type ConversionOptions = {
  outputPath?: string;
  outputDir?: string;
};

function isMp3(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".mp3");
}

/**
 * NotebookLM's CLI already produces MP3, so this only places the file where requested:
 * `outputPath` wins, then a title-based name inside `outputDir`, otherwise the input path is kept.
 */
export async function convertToMp3(
  podcast: GeneratedPodcast,
  options: ConversionOptions = {}
): Promise<ConvertedPodcast> {
  const inputPath = podcast.wavPath;

  if (!isMp3(inputPath)) {
    throw new Error(`Unsupported audio format (expected .mp3): ${inputPath}`);
  }

  const targetPath =
    options.outputPath ??
    (options.outputDir ? generateOutputPath(podcast.metadata.title, options.outputDir) : inputPath);

  if (targetPath !== inputPath) {
    await fs.copyFile(inputPath, targetPath);
    success(`Copied MP3 to: ${targetPath}`);
  }

  return toConvertedPodcast(podcast, targetPath);
}
