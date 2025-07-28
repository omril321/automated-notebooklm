import { Download } from "playwright";
import { promises as fs } from "fs";
import { join } from "path";
import { info } from "./logger";

export type DownloadMetadata = {
  title: string;
  description: string;
  filename: string;
  outputPath: string;
};

/**
 * Process a download object and generate all necessary metadata and paths
 * @param download Playwright Download object
 * @param outputDir Output directory for final files
 * @returns Complete metadata and path information
 */
export async function processDownload(
  download: Download,
  outputDir: string = "./downloads"
): Promise<DownloadMetadata> {
  await verifyWavDownload(download);

  const filename = download.suggestedFilename();
  if (!filename) {
    throw new Error("Download has no suggested filename");
  }

  const { title, description } = generateEpisodeMetadata(filename);
  const outputPath = generateOutputPath(title, outputDir);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  return {
    title,
    description,
    filename,
    outputPath,
  };
}

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
 * @param download Playwright Download object
 */
async function verifyWavDownload(download: Download): Promise<void> {
  const suggestedFilename = download.suggestedFilename();

  if (!suggestedFilename) {
    throw new Error("Download has no suggested filename. Cannot verify file format.");
  }

  if (!suggestedFilename.toLowerCase().endsWith(".wav")) {
    throw new Error(
      `Expected WAV file but download suggests: ${suggestedFilename}. ` +
        "This service only supports WAV to MP3 conversion."
    );
  }

  info(`Verified download as WAV file named: ${suggestedFilename}`);
}

/**
 * Generate episode metadata from filename
 * @param filename Original download filename
 * @returns Episode title and description
 */
function generateEpisodeMetadata(filename: string): { title: string; description: string } {
  const baseTitle = filename.replace(/\.(wav|mp3)$/i, "");

  // Clean up the filename for title
  const title = baseTitle.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

  const description = `Podcast episode: ${title}

This episode was automatically generated using NotebookLM and processed through an automated podcast generation pipeline.

Generated: ${new Date().toISOString()}`;

  return { title, description };
}

/**
 * Generate output filename for MP3 based on title and timestamp
 * @param title Episode title
 * @param outputDir Output directory
 * @returns Full path for output MP3 file
 */
function generateOutputPath(title: string, outputDir: string): string {
  // Sanitize title for filename
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\s-_]/g, "") // Remove special characters
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .substring(0, 50); // Limit length

  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${sanitizedTitle}_${timestamp}.mp3`;

  return join(outputDir, filename);
}
