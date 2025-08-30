import { describe, it, expect } from "vitest";
import { analyzeHtml } from "./htmlContentParser";

describe("htmlContentParser", () => {
  it("analyzes a basic article", async () => {
    const html = `
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

    const result = await analyzeHtml("https://example.com/article", html);

    expect(result.title).toBe("Test Article");
    expect(result.description).toBe("Test description");
    expect(result.codeContentPercentage).toBe(0);
    expect(result.isVideoArticle).toBe(false);
    expect(result.totalTextLength).toBeGreaterThan(0);
  });

  it("detects video content", async () => {
    const html = `
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

    const result = await analyzeHtml("https://example.com/video", html);

    expect(result.isVideoArticle).toBe(true);
  });

  it("calculates code percentage to be > 50% when code dominates", async () => {
    const html = `
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

    const result = await analyzeHtml("https://example.com/code", html);

    expect(result.codeContentPercentage).toBeGreaterThan(50);
    expect(result.totalTextLength).toBeGreaterThan(0);
  });

  it("handles articles without main/article tags", async () => {
    const html = `
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

    const result = await analyzeHtml("https://example.com/basic", html);

    expect(result.title).toBe("Basic Article");
    expect(result.totalTextLength).toBeGreaterThan(0);
  });

  it("prefers SEO title over page title", async () => {
    const html = `
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

    const result = await analyzeHtml("https://example.com/seo", html);

    expect(result.title).toBe("SEO Title");
  });

  it("uses url as title if no title is found", async () => {
    const html = `
      <html>
        <head></head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `;

    const result = await analyzeHtml("https://example.com/no-title", html);

    expect(result.title).toBe("https://example.com/no-title");
  });
});
