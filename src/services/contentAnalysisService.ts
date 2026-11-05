import { info, error } from "../logger";
import { ArticleAnalysis } from "./articleMetadataService";
import { analyzeHtml } from "./htmlContentParser";
import { analyzePdf } from "./pdfContentParser";

function isPdfContent(url: string, contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return ct.includes("application/pdf") || url.toLowerCase().endsWith(".pdf");
}

async function fetchWithRetry(url: string, maxRetries: number = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url);

    if (res.ok) {
      return res;
    }

    if (res.status === 429) {
      const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      info(`Rate limited (429), retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      lastError = new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      continue;
    }

    // Non-429 errors fail immediately
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

export async function analyzeArticleFromUrl(url: string): Promise<ArticleAnalysis> {
  info(`Analyzing article content: ${url}`);

  try {
    const res = await fetchWithRetry(url);
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
