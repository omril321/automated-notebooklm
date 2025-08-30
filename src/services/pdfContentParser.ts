import { info } from "../logger";
import type { ArticleAnalysis } from "./articleMetadataService";

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function filenameFromHeadersOrUrl(url: string, contentDisposition: string): string {
  const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (match && match[1]) {
    return decodeMaybe(match[1]);
  }
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return decodeMaybe(last || u.hostname);
  } catch {
    return url;
  }
}

export async function analyzePdf(url: string, headers: Headers): Promise<ArticleAnalysis> {
  const contentDisposition = headers.get("content-disposition") || "";
  const title = filenameFromHeadersOrUrl(url, contentDisposition);
  info(`Detected PDF content, using filename as title: ${title}`);
  return {
    title,
    description: undefined,
    codeContentPercentage: 0,
    isVideoArticle: false,
    totalTextLength: 0,
  };
}
