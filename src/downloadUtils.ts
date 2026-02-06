import { join } from "path";

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
