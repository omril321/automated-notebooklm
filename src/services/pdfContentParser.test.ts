import { describe, it, expect } from "vitest";
import { analyzePdf } from "./pdfContentParser";

describe("pdfContentParser", () => {
  it("uses filename from content-disposition", async () => {
    const headers = new Headers({ "content-disposition": 'attachment; filename="report Q1.pdf"' });
    const result = await analyzePdf("https://example.com/download?id=1", headers);
    expect(result.title).toBe("report Q1.pdf");
    expect(result.description).toBeUndefined();
    expect(result.codeContentPercentage).toBe(0);
    expect(result.isVideoArticle).toBe(false);
    expect(result.totalTextLength).toBe(0);
  });

  it("falls back to URL filename when header is missing", async () => {
    const headers = new Headers();
    const result = await analyzePdf("https://example.com/files/whitepaper%20final.pdf", headers);
    expect(result.title).toBe("whitepaper final.pdf");
  });

  it("falls back to hostname when no path segment", async () => {
    const headers = new Headers();
    const result = await analyzePdf("https://docs.example.com", headers);
    expect(result.title).toBe("docs.example.com");
  });
});
