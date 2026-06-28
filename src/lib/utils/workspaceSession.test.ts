import { describe, expect, it } from "vitest";
import { normalizeChapterSection } from "./workspaceSession";

describe("normalizeChapterSection", () => {
  it("accepts valid sections", () => {
    expect(normalizeChapterSection("chapters")).toBe("chapters");
    expect(normalizeChapterSection("research")).toBe("research");
    expect(normalizeChapterSection("characters")).toBe("characters");
  });

  it("falls back to chapters for unknown or malformed values", () => {
    expect(normalizeChapterSection("bogus")).toBe("chapters");
    expect(normalizeChapterSection(null)).toBe("chapters");
    expect(normalizeChapterSection(undefined)).toBe("chapters");
    expect(normalizeChapterSection(42)).toBe("chapters");
  });
});