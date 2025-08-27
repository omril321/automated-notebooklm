import { promises as fs } from "fs";
import path from "path";
import { info, success, warning } from "../logger";

export type AudioGenerationEntry = {
  timestamp: string;
  runId: string;
  resourceUrl: string;
};

type AudioGenerationLog = {
  entries: AudioGenerationEntry[];
};

export class AudioGenerationRateLimitError extends Error {
  constructor(count: number, timeWindow: string) {
    super(`Rate limit exceeded: ${count} audio generations in the last ${timeWindow}. Please try again later.`);
    this.name = "AudioGenerationRateLimitError";
  }
}

const LOGS_DIR = "logs";
const LOG_FILE = "audio-generation.json";
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEEP_LOG_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Service for tracking audio generation requests and enforcing rate limits.
 */
export class AudioGenerationTrackingService {
  private readonly logFilePath: string;
  private readonly runId: string;

  constructor(logsDir: string = LOGS_DIR) {
    this.logFilePath = path.join(logsDir, LOG_FILE);
    this.runId = new Date().toISOString().replace(/[:.]/g, "-");
  }

  /**
   * Check rate limits and return remaining available generation slots (0..3) in the last 24 hours.
   * Does not throw on limit reached; logs and returns 0 instead.
   */
  async validateRateLimit(): Promise<number> {
    info("Checking audio generation rate limits...");

    const log = await this.readLog();
    const recentEntries = this.getEntriesInLastWindow(log.entries);
    const remaining = Math.max(0, RATE_LIMIT_COUNT - recentEntries.length);

    if (remaining === 0) {
      warning(`Rate limit exceeded: ${recentEntries.length} audio generations in the last 24 hours`);
      return 0;
    }

    success(`Rate limit check passed: ${recentEntries.length}/${RATE_LIMIT_COUNT} generations in the last 24 hours`);
    return remaining;
  }

  /**
   * Record a new audio generation attempt
   */
  async recordAudioGeneration(resourceUrl: string): Promise<void> {
    info(`Recording audio generation for URL: ${resourceUrl}`);

    const fullEntry: AudioGenerationEntry = {
      timestamp: new Date().toISOString(),
      runId: this.runId,
      resourceUrl,
    };

    const log = await this.readLog();
    log.entries.push(fullEntry);

    // cleanup old entries every time we add a new entry, to keep the log file size in check
    const cleanedLog = this.cleanupOldEntries(log);

    await this.writeLog(cleanedLog);

    success(`Audio generation recorded with run ID: ${this.runId}`);
  }

  /**
   * Get entries from the last specified time period in milliseconds
   */
  private getEntriesInLast(entries: AudioGenerationEntry[], durationMs: number): AudioGenerationEntry[] {
    const cutoffTime = new Date(Date.now() - durationMs);
    return entries.filter((entry) => new Date(entry.timestamp) > cutoffTime);
  }

  /**
   * Get entries from the last window
   */
  private getEntriesInLastWindow(entries: AudioGenerationEntry[]): AudioGenerationEntry[] {
    return this.getEntriesInLast(entries, RATE_LIMIT_WINDOW_MS);
  }

  /**
   * Remove entries older than specified days
   */
  private cleanupOldEntries(log: AudioGenerationLog): AudioGenerationLog {
    const originalCount = log.entries.length;
    const cleanedEntries = this.getEntriesInLast(log.entries, KEEP_LOG_MS);

    const removedCount = originalCount - cleanedEntries.length;
    if (removedCount > 0) {
      info(`Cleaned up ${removedCount} old audio generation entries (older than 7 days)`);
    }

    return { entries: cleanedEntries };
  }

  /**
   * Read the log file, creating it if it doesn't exist
   */
  private async readLog(): Promise<AudioGenerationLog> {
    try {
      await this.ensureLogDirectoryExists();

      const content = await fs.readFile(this.logFilePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist, return empty log
        return { entries: [] };
      }
      throw new Error(`Failed to read audio generation log: ${err}`);
    }
  }

  /**
   * Write the log file
   */
  private async writeLog(log: AudioGenerationLog): Promise<void> {
    try {
      await this.ensureLogDirectoryExists();

      const content = JSON.stringify(log, null, 2);
      await fs.writeFile(this.logFilePath, content, "utf-8");
    } catch (err) {
      throw new Error(`Failed to write audio generation log: ${err}`);
    }
  }

  /**
   * Ensure the logs directory exists
   */
  private async ensureLogDirectoryExists(): Promise<void> {
    try {
      await fs.access(path.dirname(this.logFilePath));
    } catch {
      await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
    }
  }
}

/**
 * Singleton instance for the current process
 */
export const audioGenerationTracker = new AudioGenerationTrackingService();
