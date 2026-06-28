import { describe, expect, it } from "vitest";
import { stripReviewMarks } from "./stripReviewMarks";

/** Fixtures shared with Rust compile::strip_review_marks tests. */
describe("stripReviewMarks", () => {
  it("removes insertion spans", () => {
    const html = "<p>Hello <span class=\"dt-insertion\" data-mark-id=\"1\">world</span></p>";
    expect(stripReviewMarks(html)).toBe("<p>Hello world</p>");
  });

  it("removes comment spans", () => {
    const html = "<p><span class=\"dt-comment\" data-mark-id=\"c1\">note</span> gone</p>";
    expect(stripReviewMarks(html)).toBe("<p>note gone</p>");
  });
});