import { ArticleMetadata } from "../monday/types";
import { analyzeArticleFromUrl } from "./contentAnalysisService";
import { info, success, warning, error } from "../logger";

export type ArticleAnalysis = {
  title: string;
  codeContentPercentage: number;
  isVideoArticle: boolean;
  totalTextLength: number;
  description: string | undefined;
};

// Business logic constants
const CODE_PERCENTAGE_THRESHOLD = 8;
const BATCH_SIZE = 10;

function determineContentType(analysis: ArticleAnalysis): "Video" | "Article" {
  return analysis.isVideoArticle ? "Video" : "Article";
}

function isNonPodcastable(analysis: ArticleAnalysis): boolean {
  return analysis.isVideoArticle || analysis.codeContentPercentage > CODE_PERCENTAGE_THRESHOLD;
}

/**
 * Extract metadata from a single URL
 * @param url The URL to analyze
 * @returns Structured article metadata
 */
export async function extractMetadataFromUrl(url: string): Promise<ArticleMetadata> {
  const analysis = await analyzeArticleFromUrl(url);

  return {
    title: analysis.title,
    description: analysis.description,
    contentType: determineContentType(analysis),
    isNonPodcastable: isNonPodcastable(analysis),
    codeContentPercentage: analysis.codeContentPercentage,
    totalTextLength: analysis.totalTextLength,
  };
}

/**
 * Extract metadata from multiple URLs in batches of 10
 * @param urls Array of URLs to analyze
 * @returns Array of metadata results in the same order as input
 */
export async function extractMetadataBatch(urls: string[]): Promise<Map<string, ArticleMetadata>> {
  if (urls.length === 0) {
    warning("No URLs provided for batch analysis");
    return new Map();
  }

  info(`Starting batch analysis of ${urls.length} URLs (batch size: ${BATCH_SIZE})`);
  const urlToMetadata: Map<string, ArticleMetadata> = new Map();

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(urls.length / BATCH_SIZE);

    info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} URLs)`);

    const promises = batch.map((url) => extractMetadataFromUrl(url));
    const batchResults = await Promise.allSettled(promises);
    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const url = batch[index];
        urlToMetadata.set(url, result.value);
      } else {
        logError(batch[index], result.reason);
      }
    });

    success(`Completed batch ${batchNumber}/${totalBatches}`);
  }

  success(`Batch analysis complete: processed ${urlToMetadata.size} URLs`);
  return urlToMetadata;
}

export function finalizePodcastDetails(
  urlMetadata: Partial<ArticleMetadata>,
  notebookLmDetails: { title: string; description: string }
): { title: string; description: string } {
  const { description: notebookLmDescription } = notebookLmDetails;

  const metadataDetailsStr = `
  Code content percentage: ${urlMetadata.codeContentPercentage}%
  Total text length: ${urlMetadata.totalTextLength} characters
  `;
  const finalDescription = `${notebookLmDescription}\n\n==============\n\n${metadataDetailsStr}`;

  return {
    title: notebookLmDetails.title,
    description: finalDescription,
  };
}

function logError(url: string, err: unknown) {
  error(`Failed to extract metadata for URL ${url}: ${err instanceof Error ? err.message : String(err)}`);
}
