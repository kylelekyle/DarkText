import { describe, expect, it } from "vitest";
import {
  buildMarkedDocxSections,
  collectReviewMarkIds,
  filterHandoffThreads,
} from "./markedHandoff";
import type { HandoffBundle } from "./pipeline";

function emptyBundle(overrides: Partial<HandoffBundle> = {}): HandoffBundle {
  return {
    manifest: { name: "Lib", version: 1, path: "/lib", chapters: [] },
    chapters: [],
    research: [],
    characters: [],
    threads: [],
    changeMetaByMarkId: new Map(),
    ...overrides,
  };
}

describe("markedHandoff", () => {
  it("collects change and comment mark ids from html", () => {
    const ids = collectReviewMarkIds(
      '<p><span class="dt-insertion" data-change-id="i1">x</span>' +
        '<span class="dt-comment" data-comment-id="c1">y</span></p>',
    );
    expect(ids.changeIds.has("i1")).toBe(true);
    expect(ids.commentIds.has("c1")).toBe(true);
  });

  it("builds docx sections for manuscript and sidecar items", () => {
    const bundle = emptyBundle({
      chapters: [
        {
          meta: { id: "a", title: "Ch 1", status: "draft", order: 0, updatedAt: "" },
          html: "<p>one</p>",
          section: "chapters",
        },
      ],
      research: [
        {
          meta: { id: "r", title: "Note", status: "draft", order: 0, updatedAt: "" },
          html: "<p>research</p>",
          section: "research",
        },
      ],
    });
    const sections = buildMarkedDocxSections(bundle);
    expect(sections.some((s) => s.title === "Ch 1")).toBe(true);
    expect(sections.some((s) => s.title === "Research")).toBe(true);
    expect(sections.some((s) => s.title === "Note")).toBe(true);
  });

  it("filters comment threads to ids present in exported html", () => {
    const threads = filterHandoffThreads(
      [
        {
          id: "t1",
          markId: "c1",
          anchorText: "a",
          resolved: false,
          replies: [],
        },
        {
          id: "t2",
          markId: "missing",
          anchorText: "b",
          resolved: false,
          replies: [],
        },
      ],
      new Set(["c1"]),
    );
    expect(threads).toHaveLength(1);
    expect(threads[0].markId).toBe("c1");
  });
});