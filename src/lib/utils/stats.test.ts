import { describe, expect, it } from "vitest";
import { computeBookTotals, htmlToPlain, statsFromHtml } from "./stats";

describe("htmlToPlain", () => {
  it("strips tags and decodes entities like Rust html_to_text", () => {
    expect(htmlToPlain("<p>Hello &amp; <strong>world</strong></p>")).toBe(
      "Hello & world",
    );
  });
});

describe("statsFromHtml", () => {
  it("matches Rust stats_from_html word count", () => {
    const stats = statsFromHtml("<p>Hello <strong>world</strong></p>");
    expect(stats.words).toBe(2);
    expect(stats.chars).toBeGreaterThanOrEqual(11);
  });
});

describe("computeBookTotals", () => {
  it("sums cached stats and overrides active chapter", () => {
    const chapters = [
      { id: "a", title: "A", status: "draft" as const, order: 0, updatedAt: "", wordCount: 100, charCount: 500 },
      { id: "b", title: "B", status: "draft" as const, order: 1, updatedAt: "", wordCount: 200, charCount: 900 },
    ];
    const totals = computeBookTotals(
      chapters,
      { a: { words: 100, chars: 500 }, b: { words: 200, chars: 900 } },
      { chapterId: "a", words: 150, chars: 600 },
    );
    expect(totals.words).toBe(350);
    expect(totals.chars).toBe(1500);
    expect(totals.pages).toBe(2);
  });
});