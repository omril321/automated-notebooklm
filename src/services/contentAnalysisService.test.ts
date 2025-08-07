import { describe, it, expect, vi, beforeEach, afterEach, Mocked, MockInstance } from "vitest";
import { analyzeArticleFromUrl } from "./contentAnalysisService";

// Mock the logger
vi.mock("../logger", () => ({
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

describe("ContentAnalysisService", () => {
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
    vi.clearAllMocks();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("analyzeArticleFromUrl", () => {
    it("should analyze a basic article", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Test Article</title>
            <meta name="description" content="Test description">
          </head>
          <body>
            <article>
              <h1>Test Article</h1>
              <p>This is a test article with some content.</p>
            </article>
          </body>
        </html>
      `;
      mockFetch(mockHtml);

      const result = await analyzeArticleFromUrl("https://example.com/article");

      expect(result).toEqual({
        title: "Test Article",
        description: "Test description",
        codeContentPercentage: 0,
        isVideoArticle: false,
        totalTextLength: 96,
      });
    });

    it("should detect video content", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Video Article</title>
          </head>
          <body>
            <article>
              <h1>Video Article</h1>
              <iframe src="https://youtube.com/embed/123"></iframe>
              <p>Watch the video to learn more.</p>
            </article>
          </body>
        </html>
      `;
      mockFetch(mockHtml);

      const result = await analyzeArticleFromUrl("https://example.com/video");

      expect(result.isVideoArticle).toBe(true);
    });

    it("should calculate code percentage correctly", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Code Article</title>
          </head>
          <body>
            <article>
              <h1>Code Article</h1>
              <p>Short text.</p>
              <pre>function test() {
  console.log("This is a long code block that should affect the percentage");
  return true;
}</pre>
            </article>
          </body>
        </html>
      `;
      mockFetch(mockHtml);

      const result = await analyzeArticleFromUrl("https://example.com/code");

      expect(result.codeContentPercentage).toBeCloseTo(100 * (112 / 193), 3);
      expect(result.totalTextLength).toBe(193);
    });

    it("should handle articles without main/article tags", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Basic Article</title>
          </head>
          <body>
            <h1>Basic Article</h1>
            <p>Content in body tag.</p>
          </body>
        </html>
      `;

      mockFetch(mockHtml);

      const result = await analyzeArticleFromUrl("https://example.com/basic");

      expect(result.title).toBe("Basic Article");
      expect(result.totalTextLength).toBe(86);
    });

    it("should prefer SEO title over page title", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>Page Title</title>
            <meta property="og:title" content="SEO Title">
          </head>
          <body>
            <p>Content</p>
          </body>
        </html>
      `;

      mockFetch(mockHtml);

      const result = await analyzeArticleFromUrl("https://example.com/seo");

      expect(result.title).toBe("SEO Title");
    });

    it("should throw error on fetch failure", async () => {
      mockFetchRejected(new Error("Network error"));

      await expect(analyzeArticleFromUrl("https://example.com/fail")).rejects.toThrow("Network error");
    });
  });

  function mockFetch(html: string) {
    fetchSpy.mockResolvedValueOnce({
      text: () => Promise.resolve(html),
    } as Response);
  }

  function mockFetchRejected(error: Error) {
    fetchSpy.mockRejectedValueOnce(error);
  }
});
