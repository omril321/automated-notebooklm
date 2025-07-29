import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";

export const TEST_FIXTURES_DIR = path.join(__dirname, "../fixtures");
export const TEST_OUTPUT_DIR = path.join(__dirname, "../temp-output");

/**
 * Create test output directory for temporary files during testing
 */
export async function createTestOutputDir(): Promise<void> {
  await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
}

/**
 * Clean up test output directory after testing
 */
export async function cleanupTestOutputDir(): Promise<void> {
  try {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors in tests
    console.warn("Failed to cleanup test output directory:", error);
  }
}

/**
 * Get path to test fixture file
 */
export function getTestFixturePath(filename: string): string {
  return path.join(TEST_FIXTURES_DIR, filename);
}

/**
 * Get path for test output file
 */
export function getTestOutputPath(filename: string): string {
  return path.join(TEST_OUTPUT_DIR, filename);
}

/**
 * Generate a unique test filename with timestamp
 */
export function generateTestFilename(baseName: string, extension: string): string {
  const timestamp = Date.now();
  return `${baseName}-${timestamp}.${extension}`;
}

/**
 * Validate that a file exists and has content
 */
export async function validateFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile() && stats.size > 0;
  } catch {
    return false;
  }
}

/**
 * Check if FFmpeg is available in the system
 * This is for integration testing - we want to ensure FFmpeg works properly
 */
export function checkFfmpegAvailable(): boolean {
  try {
    exec("ffmpeg -version");
    return true;
  } catch {
    return false;
  }
}
