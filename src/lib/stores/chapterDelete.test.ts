import { describe, expect, it, beforeEach } from "vitest";
import { nextChapterIdAfterDelete } from "./chapterDelete";
import { libraryStore } from "./library.svelte";
import type { ChapterMeta } from "$lib/types";

function meta(id: string, order: number): ChapterMeta {
  return { id, title: id, status: "draft", order, updatedAt: "" };
}

describe("nextChapterIdAfterDelete", () => {
  beforeEach(() => {
    libraryStore.library = {
      name: "Lib",
      version: 1,
      path: "/lib",
      chapters: [meta("a", 0), meta("b", 1), meta("c", 2)],
    };
    libraryStore.researchChapters = [meta("r1", 0), meta("r2", 1)];
    libraryStore.characterChapters = [];
  });

  it("prefers the next sibling in main chapters", () => {
    expect(nextChapterIdAfterDelete("b", "chapters")).toBe("c");
  });

  it("falls back to previous sibling when deleting the last item", () => {
    expect(nextChapterIdAfterDelete("c", "chapters")).toBe("b");
  });

  it("works for research sections", () => {
    expect(nextChapterIdAfterDelete("r1", "research")).toBe("r2");
  });

  it("returns undefined when the section becomes empty", () => {
    libraryStore.researchChapters = [meta("r1", 0)];
    expect(nextChapterIdAfterDelete("r1", "research")).toBeUndefined();
  });
});