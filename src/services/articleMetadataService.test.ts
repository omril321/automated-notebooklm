import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractMetadataFromUrl, extractMetadataBatch } from "./articleMetadataService";
import * as contentAnalysisService from "./contentAnalysisService";
import { ArticleAnalysis } from "../types";
import { ArticleMetadata } from "../monday/types";

// Mock the logger
vi.mock("../logger", () => ({
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

// Mock the content analysis service
vi.mock("./contentAnalysisService");

// Test data factory functions
const createMockAnalysis = (overrides: Partial<ArticleAnalysis> = {}): ArticleAnalysis => ({
  title: "Test Article",
  description: "Test description",
  codeContentPercentage: 0.05,
  isVideoArticle: false,
  totalTextLength: 1000,
  ...overrides,
});

// Test helper functions
const mockAnalysisAndTest = async (
  overrides: Partial<ArticleAnalysis> = {},
  url: string = "https://example.com/test"
): Promise<ArticleMetadata> => {
  const analysis = createMockAnalysis(overrides);
  vi.mocked(contentAnalysisService.analyzeArticleFromUrl).mockResolvedValueOnce(analysis);
  return await extractMetadataFromUrl(url);
};

describe("ArticleMetadataService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractMetadataFromUrl", () => {
    it("should extract metadata for a regular article", async () => {
      const result = await mockAnalysisAndTest({}, "https://example.com/article");

      expect(result).toEqual({
        title: "Test Article",
        description: "Test description",
        contentType: "Article",
        isNonPodcastable: false,
        codeContentPercentage: 0.05,
        totalTextLength: 1000,
      });
    });

    it("should mark video content as non-podcastable", async () => {
      const result = await mockAnalysisAndTest(
        {
          title: "Video Article",
          description: "Video description",
          codeContentPercentage: 0.02,
          isVideoArticle: true,
          totalTextLength: 500,
        },
        "https://example.com/video"
      );

      expect(result.contentType).toBe("Video");
      expect(result.isNonPodcastable).toBe(true);
    });

    it("should mark high-code content as non-podcastable", async () => {
      const result = await mockAnalysisAndTest(
        {
          title: "Code Article",
          description: "Code description",
          codeContentPercentage: 8.001, // Above 8% threshold
          totalTextLength: 800,
        },
        "https://example.com/code"
      );

      expect(result.contentType).toBe("Article");
      expect(result.isNonPodcastable).toBe(true);
    });

    it("should handle exactly 8% code content as podcastable", async () => {
      const result = await mockAnalysisAndTest(
        {
          title: "Borderline Article",
          description: "Borderline description",
          codeContentPercentage: 8, // Exactly the threshold of 8%
          totalTextLength: 1200,
        },
        "https://example.com/borderline"
      );

      expect(result.isNonPodcastable).toBe(false);
    });

    it("should handle missing description", async () => {
      const result = await mockAnalysisAndTest(
        {
          title: "No Description Article",
          description: undefined,
          codeContentPercentage: 0.03,
          totalTextLength: 600,
        },
        "https://example.com/no-desc"
      );

      expect(result.description).toBeUndefined();
    });
  });

  describe("extractMetadataBatch", () => {
    it("should process multiple URLs in batches", async () => {
      const mockAnalyses = [
        createMockAnalysis({
          title: "Article 1",
          description: "Description 1",
          codeContentPercentage: 0.02,
          totalTextLength: 500,
        }),
        createMockAnalysis({
          title: "Article 2",
          description: "Description 2",
          codeContentPercentage: 0.05,
          isVideoArticle: true,
          totalTextLength: 800,
        }),
      ];

      vi.mocked(contentAnalysisService.analyzeArticleFromUrl)
        .mockResolvedValueOnce(mockAnalyses[0])
        .mockResolvedValueOnce(mockAnalyses[1]);

      const urls = ["https://example.com/1", "https://example.com/2"];
      const results = await extractMetadataBatch(urls);

      const expectedResults = new Map([
        [
          "https://example.com/1",
          {
            title: "Article 1",
            description: "Description 1",
            contentType: "Article",
            isNonPodcastable: false,
            codeContentPercentage: 0.02,
            totalTextLength: 500,
          },
        ],
        [
          "https://example.com/2",
          {
            title: "Article 2",
            description: "Description 2",
            contentType: "Video",
            isNonPodcastable: true,
            codeContentPercentage: 0.05,
            totalTextLength: 800,
          },
        ],
      ]);
      expect(results).toEqual(expectedResults);
    });

    it("should handle empty URL array", async () => {
      const results = await extractMetadataBatch([]);

      expect(results).toEqual(new Map());
      expect(contentAnalysisService.analyzeArticleFromUrl).not.toHaveBeenCalled();
    });

    it("should filter out failed URLs", async () => {
      vi.mocked(contentAnalysisService.analyzeArticleFromUrl).mockRejectedValueOnce(new Error("Analysis failed"));

      const urls = ["https://example.com/fail"];

      await expect(extractMetadataBatch(urls)).resolves.toEqual(new Map());
    });

    it("should handle partial batch failures", async () => {
      vi.mocked(contentAnalysisService.analyzeArticleFromUrl)
        .mockResolvedValueOnce(
          createMockAnalysis({
            title: "Success",
            description: "Success desc",
            codeContentPercentage: 0.02,
            totalTextLength: 500,
          })
        )
        .mockRejectedValueOnce(new Error("Second URL failed"));

      const urls = ["https://example.com/success", "https://example.com/fail"];

      const expectedResults = new Map([
        [
          "https://example.com/success",
          {
            title: "Success",
            description: "Success desc",
            contentType: "Article",
            isNonPodcastable: false,
            codeContentPercentage: 0.02,
            totalTextLength: 500,
          },
        ],
      ]);
      await expect(extractMetadataBatch(urls)).resolves.toEqual(expectedResults);
    });
  });

  describe("Business logic thresholds", () => {
    it.each([
      { codeContentPercentage: 7.999, expectedNonPodcastable: false },
      { codeContentPercentage: 8, expectedNonPodcastable: false },
      { codeContentPercentage: 8.001, expectedNonPodcastable: true },
      { codeContentPercentage: 10, expectedNonPodcastable: true },
    ])(
      "should mark content with $codeContentPercentage code as non-podcastable: $expectedNonPodcastable",
      async ({ codeContentPercentage, expectedNonPodcastable }) => {
        const result = await mockAnalysisAndTest({
          title: "Test",
          description: "Test",
          codeContentPercentage,
          totalTextLength: 1000,
        });

        expect(result.isNonPodcastable).toBe(expectedNonPodcastable);
      }
    );
  });
});
