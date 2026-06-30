import { describe, expect, it } from "vitest";
import {
  REVIEW_AUTHOR_PALETTE,
  REVIEW_UNKNOWN_COLOR,
  colorForAuthor,
} from "./reviewColors";

describe("colorForAuthor", () => {
  it("returns a palette color for a named author", () => {
    expect(REVIEW_AUTHOR_PALETTE).toContain(colorForAuthor("Editor"));
  });

  it("is stable for the same author", () => {
    expect(colorForAuthor("Jane")).toBe(colorForAuthor("Jane"));
  });

  it("falls back to the neutral color for missing authors", () => {
    expect(colorForAuthor(null)).toBe(REVIEW_UNKNOWN_COLOR);
    expect(colorForAuthor("")).toBe(REVIEW_UNKNOWN_COLOR);
    expect(colorForAuthor("   ")).toBe(REVIEW_UNKNOWN_COLOR);
  });
});
