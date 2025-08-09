import { Download } from "playwright";
import { promises as fs } from "fs";
import { join } from "path";
import { info } from "./logger";

/**
 * Save download to temporary file for processing
 * @param download Playwright Download object
 * @param tempDir Temporary directory (defaults to ./temp)
 * @returns Path to temporary file
 */
export async function saveToTempFile(download: Download, tempDir: string = "./temp"): Promise<string> {
  await fs.mkdir(tempDir, { recursive: true });

  const timestamp = Date.now();
  const filename = download.suggestedFilename() || `podcast_${timestamp}.wav`;
  const tempPath = join(tempDir, filename);

  info(`Saving download to temporary file: ${tempPath}`);
  await download.saveAs(tempPath);

  return tempPath;
}

/**
 * Clean up temporary file
 * @param filePath Path to file to delete
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    info(`Cleaned up temporary file: ${filePath}`);
  } catch (cleanupError: unknown) {
    // Log but don't throw - cleanup failure shouldn't stop the process
    const errorMessage = cleanupError instanceof Error ? cleanupError.message : "Unknown error";
    info(`Warning: Failed to cleanup temporary file ${filePath}: ${errorMessage}`);
  }
}

/**
 * Verify that the download appears to be a WAV file
 */
export async function verifyWavDownload(wavPath: string): Promise<void> {
  if (!wavPath.toLowerCase().endsWith(".wav")) {
    throw new Error(
      `Expected WAV file but download suggests: ${wavPath}. ` + "This service only supports WAV to MP3 conversion."
    );
  }

  info(`Verified download as WAV file named: ${wavPath}`);
}

/**
 * Generate output filename for MP3 based on title
 * @param title Episode title
 * @param outputDir Output directory
 * @returns Full path for output MP3 file
 */
export function generateOutputPath(title: string, outputDir: string): string {
  // Sanitize title for filename
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\s-_]/g, "") // Remove special characters
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .substring(0, 50); // Limit length

  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${sanitizedTitle}_${timestamp}.mp3`;

  return join(outputDir, filename);
}
