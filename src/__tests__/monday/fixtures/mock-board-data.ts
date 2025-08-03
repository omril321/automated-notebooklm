/**
 * Mock Monday.com board data for testing
 */

import { Board, Column, ColumnType, BoardKind, State, User, Account, FirstDayOfTheWeek } from "@mondaydotcomorg/api";

const mockAccount: Account = {
  id: "12345",
  name: "Test Account",
  slug: "test-account",
  first_day_of_the_week: FirstDayOfTheWeek.Monday,
  show_timeline_weekends: false,
};

const mockUser: User = {
  id: "1",
  name: "Test User",
  email: "test@example.com",
  account: mockAccount,
  enabled: true,
  url: "https://test.monday.com/users/1",
};

export const mockValidColumns: Column[] = [
  {
    id: "podcast_link",
    title: "Podcast link",
    type: ColumnType.Link,
    archived: false,
    settings_str: "{}",
    width: 120,
  },
  {
    id: "type",
    title: "Type",
    type: ColumnType.Status,
    archived: false,
    settings_str: '{"labels":[{"id":"1","name":"Article","color":"#0086c0"}]}',
    width: 100,
  },
  {
    id: "source_url",
    title: "🔗",
    type: ColumnType.Link,
    archived: false,
    settings_str: "{}",
    width: 80,
  },
  {
    id: "name",
    title: "Name",
    type: ColumnType.Name,
    archived: false,
    settings_str: "{}",
    width: 200,
  },
];

export const mockInvalidColumns: Column[] = [
  {
    id: "podcast_link",
    title: "Podcast link",
    type: ColumnType.Link,
    archived: false,
    settings_str: "{}",
    width: 120,
  },
  {
    id: "type",
    title: "Type",
    type: ColumnType.Text, // Wrong type - should be status
    archived: false,
    settings_str: "{}",
    width: 100,
  },
  {
    id: "name",
    title: "Name",
    type: ColumnType.Name,
    archived: false,
    settings_str: "{}",
    width: 200,
  },
];

export const mockValidBoard: Board = {
  id: "123456789",
  name: "Test Board",
  columns: mockValidColumns,
  board_kind: BoardKind.Public,
  permissions: "read_write",
  state: State.All,
  url: "https://test.monday.com/boards/123456789",
  creator: mockUser,
  owner: mockUser, // Deprecated but required
  owners: [],
  collaborators: [],
  subscribers: [],
  items_page: {
    cursor: null,
    items: [],
  },
  top_group: {
    id: "topics",
    title: "Topics",
    color: "#0086c0",
    position: "1",
    items_page: {
      cursor: null,
      items: [],
    },
  },
};

export const mockInvalidBoard: Board = {
  id: "987654321",
  name: "Invalid Test Board",
  columns: mockInvalidColumns,
  board_kind: BoardKind.Public,
  permissions: "read_write",
  state: State.All,
  url: "https://test.monday.com/boards/987654321",
  creator: mockUser,
  owner: mockUser, // Deprecated but required
  owners: [],
  collaborators: [],
  subscribers: [],
  items_page: {
    cursor: null,
    items: [],
  },
  top_group: {
    id: "topics",
    title: "Topics",
    color: "#0086c0",
    position: "1",
    items_page: {
      cursor: null,
      items: [],
    },
  },
};

// Mock column values for testing
const createMockColumnValue = (id: string, value: string | null, text: string | null): any => ({
  id,
  type: "text",
  value,
  text,
});

// Mock board items that are article candidates (empty podcast link + Type=Article)
export const mockArticleCandidateItems: any[] = [
  {
    id: "item_1",
    name: "Test Article 1",
    url: "https://test.monday.com/items/item_1",
    column_values: [
      createMockColumnValue("podcast_link", null, null), // Empty podcast link
      createMockColumnValue("type", "Article", "Article"), // Type = Article
      createMockColumnValue("source_url", "https://example.com/article1", "https://example.com/article1"),
    ],
    board: { id: "123456789", name: "Test Board" },
    group: { id: "group_1", title: "Topics" },
  },
  {
    id: "item_2",
    name: "Test Article 2",
    url: "https://test.monday.com/items/item_2",
    column_values: [
      createMockColumnValue("podcast_link", null, null), // Empty podcast link
      createMockColumnValue("type", "Article", "Article"), // Type = Article
      createMockColumnValue("source_url", null, null), // No source URL
    ],
    board: { id: "123456789", name: "Test Board" },
    group: { id: "group_1", title: "Topics" },
  },
];

// Mock board items that are NOT candidates (have podcast link or wrong type)
export const mockNonCandidateItems: any[] = [
  {
    id: "item_3",
    name: "Already Has Podcast",
    url: "https://test.monday.com/items/item_3",
    column_values: [
      createMockColumnValue(
        "podcast_link",
        "https://podcast.example.com/episode1",
        "https://podcast.example.com/episode1"
      ),
      createMockColumnValue("type", "Article", "Article"),
      createMockColumnValue("source_url", "https://example.com/article3", "https://example.com/article3"),
    ],
    board: { id: "123456789", name: "Test Board" },
    group: { id: "group_1", title: "Topics" },
  },
  {
    id: "item_4",
    name: "Wrong Type",
    url: "https://test.monday.com/items/item_4",
    column_values: [
      createMockColumnValue("podcast_link", null, null),
      createMockColumnValue("type", "Video", "Video"), // Wrong type
      createMockColumnValue("source_url", "https://example.com/video1", "https://example.com/video1"),
    ],
    board: { id: "123456789", name: "Test Board" },
    group: { id: "group_1", title: "Topics" },
  },
];

export const mockBoardWithItems: Board = {
  ...mockValidBoard,
  items_page: {
    cursor: null,
    items: [...mockArticleCandidateItems, ...mockNonCandidateItems],
  },
};
