import { describe, expect, it } from "vitest";
import {
  compileChapterHeading,
  compileShowChapterNumbers,
  compileShowChapterTitles,
} from "./compileDisplayPrefs";

describe("compileDisplayPrefs", () => {
  it("defaults both display options to true", () => {
    expect(compileShowChapterNumbers(undefined)).toBe(true);
    expect(compileShowChapterTitles(undefined)).toBe(true);
    expect(compileShowChapterNumbers({})).toBe(true);
    expect(compileShowChapterTitles({})).toBe(true);
  });

  it("respects explicit false", () => {
    expect(
      compileShowChapterNumbers({ compileShowChapterNumbers: false }),
    ).toBe(false);
    expect(compileShowChapterTitles({ compileShowChapterTitles: false })).toBe(
      false,
    );
  });

  it("builds compile headings from display prefs", () => {
    expect(compileChapterHeading(3, "Winter Ridge", undefined)).toBe(
      "Chapter 3 — Winter Ridge",
    );
    expect(
      compileChapterHeading(3, "Winter Ridge", {
        compileShowChapterTitles: false,
      }),
    ).toBe("Chapter 3");
    expect(
      compileChapterHeading(3, "Winter Ridge", {
        compileShowChapterNumbers: false,
      }),
    ).toBe("Winter Ridge");
    expect(
      compileChapterHeading(3, "Winter Ridge", {
        compileShowChapterNumbers: false,
        compileShowChapterTitles: false,
      }),
    ).toBeUndefined();
  });
});