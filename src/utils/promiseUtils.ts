import * as logger from "../logger";

/**
 * Sleep for specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Process items in batches with optional delays between batches
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    delayMs?: number;
    logItemName?: string;
  } = {}
): Promise<R[]> {
  const { batchSize = 10, delayMs = 0, logItemName = "items" } = options;

  const finalResults: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    logger.info(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)} (${
        batch.length
      } ${logItemName})`
    );

    const batchResults = await Promise.all(batch.map(processor));
    finalResults.push(...batchResults);
    // Add delay between batches (except for the last batch)
    if (delayMs > 0 && i + batchSize < items.length) {
      logger.info(`Waiting ${delayMs / 1000} seconds before next batch...`);
      await sleep(delayMs);
    }
  }

  return finalResults;
}
