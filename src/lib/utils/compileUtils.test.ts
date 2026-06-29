import { describe, expect, it } from "vitest";
import {
  compileChapterHeading,
  compileShowChapterNumbers,
  compileShowChapterTitles,
  mergeFinalChapterOrder,
} from "./compileUtils";

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

describe("mergeFinalChapterOrder", () => {
  const full = [
    { id: "a", title: "A", status: "draft" as const, order: 0, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "b", title: "B", status: "final" as const, order: 1, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "c", title: "C", status: "draft" as const, order: 2, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "d", title: "D", status: "final" as const, order: 3, updatedAt: "2026-01-01T00:00:00Z" },
  ];
  const finals = full.filter((c) => c.status === "final");

  it("reorders final chapters within the full list", () => {
    const merged = mergeFinalChapterOrder(full, finals, ["d", "b"]);
    expect(merged?.map((c) => c.id)).toEqual(["a", "d", "c", "b"]);
  });

  it("returns null when ids do not match finals", () => {
    expect(mergeFinalChapterOrder(full, finals, ["b"])).toBeNull();
  });
});