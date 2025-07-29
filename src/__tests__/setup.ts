import { vi, afterEach } from "vitest";

// Global cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
});
