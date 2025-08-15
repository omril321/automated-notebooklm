import { ArticleMetadata } from "../monday/types";
import { analyzeArticleFromUrl } from "./contentAnalysisService";
import { info, success, warning, error } from "../logger";
import { constructMondayItemUrl } from "../monday/service";

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

/**
 * Build links section for podcast description
 * @param sourceUrl Original article URL
 * @param mondayItemId Optional Monday board item ID
 * @returns Formatted links section string
 */
function buildLinksSection(sourceUrl: string, mondayItemId?: string): string {
  const links = [`🔗 Original article: ${sourceUrl}`];

  if (mondayItemId) {
    try {
      const mondayItemUrl = constructMondayItemUrl(mondayItemId);
      links.push(`📋 Monday item: ${mondayItemUrl}`);
    } catch (err) {
      // Silently handle Monday URL construction errors for graceful degradation
      warning(
        `Failed to construct Monday item URL for item ${mondayItemId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return links.join("\n");
}

export function finalizePodcastDetails(
  urlMetadata: ArticleMetadata,
  notebookLmDetails: { title: string; description: string },
  sourceUrl: string,
  mondayItemId?: string
): { title: string; description: string } {
  info(
    `Finalizing podcast details for "${urlMetadata.title}" (Content Type: ${urlMetadata.contentType}, ` +
      `Code Content Percentage: ${urlMetadata.codeContentPercentage}%, ` +
      `Total Text Length: ${urlMetadata.totalTextLength}, ` +
      `Is Non-Podcastable: ${urlMetadata.isNonPodcastable})`
  );
  const { description: notebookLmDescription } = notebookLmDetails;

  if (!Number.isFinite(urlMetadata.codeContentPercentage) || !Number.isFinite(urlMetadata.totalTextLength)) {
    const errMsg = `Code content percentage or total text length is not available for ${urlMetadata.title}. This indicates that something is wrong in the flow, perhaps some bug.`;
    error(errMsg);
    throw new Error(errMsg);
  }

  const metadataDetailsStr = `
  Code content percentage: ${urlMetadata.codeContentPercentage}%
  Total text length: ${urlMetadata.totalTextLength} characters
  `;

  const linksSection = buildLinksSection(sourceUrl, mondayItemId);
  const finalDescription = `${notebookLmDescription}\n\n==============\n\n${metadataDetailsStr}\n${linksSection}`;

  return {
    title: notebookLmDetails.title,
    description: finalDescription,
  };
}

function logError(url: string, err: unknown) {
  error(`Failed to extract metadata for URL ${url}: ${err instanceof Error ? err.message : String(err)}`);
}
