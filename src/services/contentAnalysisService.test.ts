import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from "vitest";
import { analyzeArticleFromUrl } from "./contentAnalysisService";

// Mock the logger
vi.mock("../logger", () => ({
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

// Mock parsers
vi.mock("./htmlContentParser", () => ({
  analyzeHtml: vi.fn(async (_url: string, _html: string) => ({
    title: "HTML Title",
    description: "Desc",
    codeContentPercentage: 0,
    isVideoArticle: false,
    totalTextLength: 10,
  })),
}));

vi.mock("./pdfContentParser", () => ({
  analyzePdf: vi.fn(async (_url: string, _headers: Headers) => ({
    title: "PDF Title",
    description: undefined,
    codeContentPercentage: 0,
    isVideoArticle: false,
    totalTextLength: 0,
  })),
}));

import { analyzeHtml } from "./htmlContentParser";
import { analyzePdf } from "./pdfContentParser";

describe("ContentAnalysisService (delegator)", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
    vi.clearAllMocks();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("delegates to HTML parser for text/html", async () => {
    mockFetchHtml("<html><head><title>X</title></head><body>ok</body></html>");

    const result = await analyzeArticleFromUrl("https://example.com/article");

    expect(analyzeHtml).toHaveBeenCalledTimes(1);
    expect(analyzePdf).not.toHaveBeenCalled();
    expect(result.title).toBe("HTML Title");
  });

  it("delegates to PDF parser for application/pdf by content-type", async () => {
    mockFetchPdf({ contentDisposition: 'attachment; filename="x.pdf"' });

    const result = await analyzeArticleFromUrl("https://example.com/x");

    expect(analyzePdf).toHaveBeenCalledTimes(1);
    expect(analyzeHtml).not.toHaveBeenCalled();
    expect(result.title).toBe("PDF Title");
  });

  it("delegates to PDF parser for .pdf URL even without content-type", async () => {
    mockFetchUnknown();

    const result = await analyzeArticleFromUrl("https://example.com/file.pdf");

    expect(analyzePdf).toHaveBeenCalledTimes(1);
    expect(analyzeHtml).not.toHaveBeenCalled();
    expect(result.title).toBe("PDF Title");
  });

  it("throws on fetch failure", async () => {
    mockFetchRejected(new Error("Network error"));

    await expect(analyzeArticleFromUrl("https://example.com/fail")).rejects.toThrow("Network error");
  });

  function mockFetchHtml(html: string) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "text/html" : null) },
      text: () => Promise.resolve(html),
    } as any);
  }

  function mockFetchPdf({ contentDisposition }: { contentDisposition: string }) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type"
            ? "application/pdf"
            : name.toLowerCase() === "content-disposition"
              ? contentDisposition
              : null,
      },
      text: () => Promise.resolve(""),
    } as any);
  }

  function mockFetchUnknown() {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: (_: string) => null },
      text: () => Promise.resolve(""),
    } as any);
  }

  function mockFetchRejected(error: Error) {
    fetchSpy.mockRejectedValueOnce(error);
  }
});
