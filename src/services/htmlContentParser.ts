import * as cheerio from "cheerio";
import { success } from "../logger";
import type { ArticleAnalysis } from "./articleMetadataService";

function getMetaContent($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const content = $(selector).attr("content")?.trim();
    if (content) return content;
  }
}

function findMainContent($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  if ($("article").length > 0) return $("article");
  if ($("main").length > 0) return $("main");
  return $("body");
}

function calculateCodeMetrics(mainContent: cheerio.Cheerio<any>): {
  codeContentPercentage: number;
  totalTextLength: number;
} {
  const codeBlocks = mainContent.find("pre");
  const codeText = codeBlocks.text();
  const codeLength = codeText.length;

  const nonCodeText = mainContent.clone().find("pre").remove().end().text();
  const nonCodeLength = nonCodeText.length;

  const totalTextLength = codeLength + nonCodeLength;
  const codePercentage = totalTextLength > 0 ? codeLength / totalTextLength : 0;

  return {
    codeContentPercentage: parseFloat((codePercentage * 100).toFixed(3)),
    totalTextLength,
  };
}

function detectVideoContent(mainContent: cheerio.Cheerio<any>): boolean {
  return (
    mainContent.find('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0 ||
    mainContent.text().toLowerCase().includes("watch the video")
  );
}

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

export async function analyzeHtml(url: string, html: string): Promise<ArticleAnalysis> {
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
}
