import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBoardItems } from "./api";
import { REQUIRED_COLUMNS } from "./config";

// Silence logs in tests
vi.mock("../logger", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

const requestMock = vi.fn();

vi.mock("./api-client", () => ({
  getMondayApiClient: () => ({ request: requestMock }),
}));

describe("monday/api.getBoardItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps GraphQL response to SourceBoardItem[] correctly", async () => {
    const linkValue = JSON.stringify({ url: "https://example.com/a1", text: "a1" });
    requestMock.mockResolvedValueOnce({
      boards: [
        {
          items_page: {
            items: [
              {
                id: "1",
                name: "Item 1",
                group: { id: "g1", title: "Topics" },
                column_values: [
                  { id: REQUIRED_COLUMNS.sourceUrl.id, value: linkValue, text: "a1", type: "link" },
                  { id: REQUIRED_COLUMNS.podcastFitness.id, display_value: "7", type: "formula" },
                  {
                    id: REQUIRED_COLUMNS.metadata.id,
                    value: JSON.stringify({
                      title: "T1",
                      contentType: "Article",
                      isNonPodcastable: false,
                      codeContentPercentage: 1,
                      totalTextLength: 10,
                    }),
                    type: "long_text",
                  },
                  { id: REQUIRED_COLUMNS.type.id, text: "Article", type: "status" },
                  {
                    id: REQUIRED_COLUMNS.nonPodcastable.id,
                    value: JSON.stringify({ checked: "false" }),
                    type: "checkbox",
                  },
                ],
              },
              {
                id: "2",
                name: "Item 2",
                group: null,
                column_values: [
                  { id: REQUIRED_COLUMNS.sourceUrl.id, value: "not-json", text: null, type: "link" },
                  { id: REQUIRED_COLUMNS.podcastFitness.id, display_value: "0", type: "formula" },
                  { id: REQUIRED_COLUMNS.metadata.id, value: "{bad json}", type: "long_text" },
                  { id: REQUIRED_COLUMNS.type.id, text: "Article", type: "status" },
                  { id: REQUIRED_COLUMNS.nonPodcastable.id, value: null, type: "checkbox" },
                ],
              },
            ],
          },
        },
      ],
    });

    const result = await getBoardItems({ boardId: "b1", excludedGroups: [] });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "1",
      name: "Item 1",
      sourceUrlValue: { url: "https://example.com/a1", text: "a1" },
      podcastFitness: 7,
      metadata: expect.objectContaining({ title: "T1", contentType: "Article" }),
      nonPodcastable: false,
      type: "Article",
      group: { id: "g1", title: "Topics" },
    });
    expect(result[1]).toMatchObject({
      id: "2",
      sourceUrlValue: undefined,
      podcastFitness: 0,
      metadata: undefined,
      nonPodcastable: null,
      type: "Article",
      group: null,
    });
  });

  it("throws when Monday returns no items container", async () => {
    requestMock.mockResolvedValueOnce({ boards: [] });
    await expect(getBoardItems({ boardId: "b1", excludedGroups: [] })).rejects.toThrow(
      /Unexpected response from Monday API - no items found/
    );
  });

  it("throws when LIMIT is reached (requires pagination)", async () => {
    const items = Array.from({ length: 500 }).map((_, i) => ({
      id: String(i + 1),
      name: `Item ${i + 1}`,
      group: null,
      column_values: [
        {
          id: REQUIRED_COLUMNS.sourceUrl.id,
          value: JSON.stringify({ url: `https://e.com/${i + 1}`, text: `t${i + 1}` }),
        },
        { id: REQUIRED_COLUMNS.podcastFitness.id, display_value: "1" },
        {
          id: REQUIRED_COLUMNS.metadata.id,
          value: JSON.stringify({
            title: `T${i + 1}`,
            contentType: "Article",
            isNonPodcastable: false,
            codeContentPercentage: 0,
            totalTextLength: 1,
          }),
        },
        { id: REQUIRED_COLUMNS.type.id, text: "Article" },
        { id: REQUIRED_COLUMNS.nonPodcastable.id, value: JSON.stringify({ checked: "false" }) },
      ],
    }));

    requestMock.mockResolvedValueOnce({ boards: [{ items_page: { items } }] });

    await expect(getBoardItems({ boardId: "b1", excludedGroups: [] })).rejects.toThrow(/implement pagination/);
  });
});
