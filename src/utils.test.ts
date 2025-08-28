import { describe, it, expect } from "vitest";
import { safeJsonParse } from "./utils";

describe("utils.safeJsonParse", () => {
  it("parses valid JSON and returns typed value", () => {
    const result = safeJsonParse<{ a: number }>('{"a":1}');
    // ensure type safety
    expect(result?.a).toEqual(1);
  });

  it("returns undefined for blank or non-string values", () => {
    expect(safeJsonParse<any>("")).toBeUndefined();
    expect(safeJsonParse<any>("   ")).toBeUndefined();
    expect(safeJsonParse<any>(undefined as any)).toBeUndefined();
    expect(safeJsonParse<any>(null as any)).toBeUndefined();
  });

  it("returns undefined for invalid JSON", () => {
    expect(safeJsonParse<any>("{invalid json}")).toBeUndefined();
  });
});
