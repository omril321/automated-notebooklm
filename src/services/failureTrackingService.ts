import { promises as fs } from "fs";
import path from "path";
import { info, warning } from "../logger";

export type FailureEntry = {
  timestamp: string;
  url: string;
  itemId: string;
  errorMessage: string;
};

type FailureLog = {
  entries: FailureEntry[];
};

const LOGS_DIR = "logs";
const LOG_FILE = "generation-failures.json";
const FAILURE_THRESHOLD = 3;
const KEEP_LOG_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Service for tracking generation failures and marking items as non-podcastable after repeated failures.
 */
export class FailureTrackingService {
  private readonly logFilePath: string;

  constructor(logsDir: string = LOGS_DIR) {
    this.logFilePath = path.join(logsDir, LOG_FILE);
  }

  /**
   * Record a generation failure for a URL
   */
  async recordFailure(url: string, itemId: string, errorMessage: string): Promise<void> {
    info(`Recording generation failure for URL: ${url}`);

    const entry: FailureEntry = {
      timestamp: new Date().toISOString(),
      url,
      itemId,
      errorMessage,
    };

    const log = await this.readLog();
    log.entries.push(entry);

    // cleanup old entries every time we add a new entry
    const cleanedLog = this.cleanupOldEntries(log);

    await this.writeLog(cleanedLog);

    const count = this.getFailureCountForUrl(cleanedLog, url);
    info(`Failure recorded. Total failures for this URL: ${count}`);
  }

  /**
   * Get the number of failures for a specific URL
   */
  async getFailureCount(url: string): Promise<number> {
    const log = await this.readLog();
    return this.getFailureCountForUrl(log, url);
  }

  /**
   * Check if a URL has exceeded the failure threshold
   */
  async shouldMarkAsNonPodcastable(url: string): Promise<boolean> {
    const count = await this.getFailureCount(url);
    const shouldMark = count >= FAILURE_THRESHOLD;

    if (shouldMark) {
      warning(`URL has failed ${count} times (threshold: ${FAILURE_THRESHOLD}), marking as non-podcastable: ${url}`);
    }

    return shouldMark;
  }

  /**
   * Get failure count for a URL from the log
   */
  private getFailureCountForUrl(log: FailureLog, url: string): number {
    return log.entries.filter((entry) => entry.url === url).length;
  }

  /**
   * Remove entries older than 30 days
   */
  private cleanupOldEntries(log: FailureLog): FailureLog {
    const cutoffTime = new Date(Date.now() - KEEP_LOG_MS);
    const originalCount = log.entries.length;
    const cleanedEntries = log.entries.filter((entry) => new Date(entry.timestamp) > cutoffTime);

    const removedCount = originalCount - cleanedEntries.length;
    if (removedCount > 0) {
      info(`Cleaned up ${removedCount} old failure entries (older than 30 days)`);
    }

    return { entries: cleanedEntries };
  }

  /**
   * Read the log file, creating it if it doesn't exist
   */
  private async readLog(): Promise<FailureLog> {
    try {
      await this.ensureLogDirectoryExists();

      const content = await fs.readFile(this.logFilePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { entries: [] };
      }
      throw new Error(`Failed to read failure log: ${err}`);
    }
  }

  /**
   * Write the log file
   */
  private async writeLog(log: FailureLog): Promise<void> {
    try {
      await this.ensureLogDirectoryExists();

      const content = JSON.stringify(log, null, 2);
      await fs.writeFile(this.logFilePath, content, "utf-8");
    } catch (err) {
      throw new Error(`Failed to write failure log: ${err}`);
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
export const failureTracker = new FailureTrackingService();
