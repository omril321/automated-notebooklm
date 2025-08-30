import { info, error } from "../logger";
import { ArticleAnalysis } from "./articleMetadataService";
import { analyzeHtml } from "./htmlContentParser";
import { analyzePdf } from "./pdfContentParser";

function isPdfContent(url: string, contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return ct.includes("application/pdf") || url.toLowerCase().endsWith(".pdf");
}

export async function analyzeArticleFromUrl(url: string): Promise<ArticleAnalysis> {
  info(`Analyzing article content: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (isPdfContent(url, contentType)) {
      return analyzePdf(url, res.headers);
    }
    const html = await res.text();
    return analyzeHtml(url, html);
  } catch (err) {
    error(`Failed to analyze content ${url}: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
