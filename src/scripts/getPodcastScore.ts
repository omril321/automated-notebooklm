import * as cheerio from "cheerio";

type ArticleAnalysis = {
  title: string;
  codePercentage: number;
  isVideoArticle: boolean;
  totalTextLength: number;
  description: string | undefined;
};

function getMetaContent($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const content = $(selector).attr("content")?.trim();
    if (content) return content;
  }
}

export async function analyzeArticle(url: string): Promise<ArticleAnalysis> {
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Try to find the main content area
  const mainContent = $("article").length > 0 ? $("article") : $("main").length > 0 ? $("main") : $("body");

  const codeBlocks = mainContent.find("pre"); // Only <pre>, not inline <code>
  const codeText = codeBlocks.text();
  const codeLength = codeText.length;

  // Remove <pre> blocks before measuring non-code text
  const nonCodeText = mainContent.clone().find("pre").remove().end().text();
  const nonCodeLength = nonCodeText.length;

  const totalLength = codeLength + nonCodeLength;
  const codePercentage = totalLength > 0 ? codeLength / totalLength : 0;

  // Detect if the article is video-based
  const hasVideo =
    mainContent.find('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0 ||
    mainContent.text().toLowerCase().includes("watch the video");

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

  const title = seoTitle || $("title").text().trim();

  return {
    title,
    description: seoDescription,
    codePercentage: parseFloat(codePercentage.toFixed(3)),
    isVideoArticle: hasVideo,
    totalTextLength: totalLength,
  };
}

const URL = "https://surma.dev/things/compile-js/";

analyzeArticle(URL).then((analysis) => {
  console.log(analysis);
});
