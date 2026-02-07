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
 * Escape special characters for safe HTML attribute usage
 */
function escapeHtmlForAttribute(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Build header section for podcast description with Monday item info and links
 * @param sourceUrl Original article URL
 * @param mondayItemId Optional Monday board item ID
 * @param mondayItemName Optional Monday board item name
 * @returns Formatted header section string
 */
function buildHeaderSection(sourceUrl: string, mondayItemId?: string, mondayItemName?: string): string {
  const lines: string[] = [];

  if (mondayItemId) {
    try {
      const mondayItemUrl = constructMondayItemUrl(mondayItemId);
      lines.push(`📋 Monday item: ${mondayItemUrl}`);
    } catch (err) {
      warning(
        `Failed to construct Monday item URL for item ${mondayItemId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  if (mondayItemName) {
    lines.push(`📌 ${mondayItemName}`);
  }

  lines.push(`🔗 Original article: ${sourceUrl}`);

  return lines.join("\n");
}

/**
 * Build header section with HTML anchor tags for clickable links
 * @param sourceUrl Original article URL
 * @param mondayItemId Optional Monday board item ID
 * @param mondayItemName Optional Monday board item name
 * @returns Formatted header section string with HTML links
 */
function buildHeaderSectionHtml(sourceUrl: string, mondayItemId?: string, mondayItemName?: string): string {
  const lines: string[] = [];

  if (mondayItemId) {
    try {
      const mondayItemUrl = constructMondayItemUrl(mondayItemId);
      const escaped = escapeHtmlForAttribute(mondayItemUrl);
      lines.push(`📋 Monday item: <a href="${escaped}">${escaped}</a>`);
    } catch (err) {
      warning(
        `Failed to construct Monday item URL for item ${mondayItemId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  if (mondayItemName) {
    const escapedName = escapeHtmlForAttribute(mondayItemName);
    lines.push(`📌 ${escapedName}`);
  }

  const escapedSource = escapeHtmlForAttribute(sourceUrl);
  lines.push(`🔗 Original article: <a href="${escapedSource}">${escapedSource}</a>`);

  return lines.join("<br>");
}

export function finalizePodcastDetails(
  urlMetadata: ArticleMetadata,
  notebookLmDetails: { title: string; description: string },
  sourceUrl: string,
  mondayItemId?: string,
  mondayItemName?: string,
  instructions?: string,
  useHtmlLinks: boolean = false
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

  const metadataDetailsStr = `Code content percentage: ${urlMetadata.codeContentPercentage}%
Total text length: ${urlMetadata.totalTextLength} characters`;

  const instructionsSection = instructions ? `\n\n==============\n\n🎙️ Podcast instructions:\n${instructions}` : "";

  if (useHtmlLinks) {
    const headerSection = buildHeaderSectionHtml(sourceUrl, mondayItemId, mondayItemName);
    const rawDescription = `${headerSection}\n\n==============\n\n${notebookLmDescription}${instructionsSection}\n\n${metadataDetailsStr}`;
    return {
      title: notebookLmDetails.title,
      description: rawDescription.replace(/\n/g, "<br>"),
    };
  }

  const headerSection = buildHeaderSection(sourceUrl, mondayItemId, mondayItemName);
  const finalDescription = `${headerSection}\n\n==============\n\n${notebookLmDescription}${instructionsSection}\n\n${metadataDetailsStr}`;

  return {
    title: notebookLmDetails.title,
    description: finalDescription,
  };
}

function logError(url: string, err: unknown) {
  error(`Failed to extract metadata for URL ${url}: ${err instanceof Error ? err.message : String(err)}`);
}
