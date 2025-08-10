import * as cheerio from "cheerio";
import { info, success, error } from "../logger";
import { ArticleAnalysis } from "./articleMetadataService";

/**
 * Extract content from meta tags using multiple selectors
 * @param $ Cheerio instance
 * @param selectors Array of CSS selectors to try
 * @returns First found content or undefined
 */
function getMetaContent($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const content = $(selector).attr("content")?.trim();
    if (content) return content;
  }
}

/**
 * Find the main content area of the page
 * @param $ Cheerio instance
 * @returns Main content element
 */
function findMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  if ($("article").length > 0) return $("article");
  if ($("main").length > 0) return $("main");
  return $("body");
}

/**
 * Calculate code-related metrics from content
 * @param mainContent Main content element
 * @returns Code percentage and total text length
 */
function calculateCodeMetrics(mainContent: cheerio.Cheerio<any>): {
  codeContentPercentage: number;
  totalTextLength: number;
} {
  const codeBlocks = mainContent.find("pre"); // Only <pre>, not inline <code>
  const codeText = codeBlocks.text();
  const codeLength = codeText.length;

  // Remove <pre> blocks before measuring non-code text
  const nonCodeText = mainContent.clone().find("pre").remove().end().text();
  const nonCodeLength = nonCodeText.length;

  const totalTextLength = codeLength + nonCodeLength;
  const codePercentage = totalTextLength > 0 ? codeLength / totalTextLength : 0;

  return {
    codeContentPercentage: parseFloat((codePercentage * 100).toFixed(3)),
    totalTextLength,
  };
}

/**
 * Detect if content is video-based
 * @param mainContent Main content element
 * @returns True if video content detected
 */
function detectVideoContent(mainContent: cheerio.Cheerio<any>): boolean {
  return (
    mainContent.find('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0 ||
    mainContent.text().toLowerCase().includes("watch the video")
  );
}

/**
 * Extract title and description from page
 * @param $ Cheerio instance
 * @returns Title and description
 */
function extractTitleAndDescription(
  url: string,
  $: cheerio.CheerioAPI
): { title: string; description: string | undefined } {
  const seoTitle = getMetaContent($, [
    "meta[property='og:title']",
    "meta[name='twitter:title']",
    "meta[name='title']",
  ])?.trim();

  const seoDescription = getMetaContent($, [
    "meta[property='og:description']",
    "meta[name='twitter:description']",
    "meta[name='description']",
  ])?.trim();

  const title = seoTitle || $("title").text().trim() || url;

  return { title, description: seoDescription };
}

/**
 * Analyze article content from a URL
 * Pure content analysis without business logic
 * @param url URL to analyze
 * @returns Article analysis result
 */
export async function analyzeArticleFromUrl(url: string): Promise<ArticleAnalysis> {
  info(`Analyzing article content: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const mainContent = findMainContent($);
    const { codeContentPercentage, totalTextLength } = calculateCodeMetrics(mainContent);
    const isVideoArticle = detectVideoContent(mainContent);
    const { title, description } = extractTitleAndDescription(url, $);

    const result = {
      title,
      description,
      codeContentPercentage,
      isVideoArticle,
      totalTextLength,
    };

    success(
      `Content analysis complete - URL: ${url}, Title: ${title} (${
        isVideoArticle ? "Video" : "Article"
      }, ${codeContentPercentage}% code)`
    );
    return result;
  } catch (err) {
    error(`Failed to analyze content ${url}: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
