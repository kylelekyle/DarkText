import { describe, expect, it, beforeEach } from "vitest";
import { chapterMetaForExport } from "./resolveExportMeta";
import { libraryStore } from "$lib/stores/library.svelte";
import type { ChapterMeta } from "$lib/types";

function meta(id: string): ChapterMeta {
  return { id, title: id, status: "draft", order: 0, updatedAt: "" };
}

describe("chapterMetaForExport", () => {
  beforeEach(() => {
    libraryStore.library = {
      name: "Lib",
      version: 1,
      path: "/lib",
      chapters: [meta("c1")],
    };
    libraryStore.researchChapters = [meta("r1")];
    libraryStore.characterChapters = [];
  });

  it("resolves main chapters", () => {
    expect(chapterMetaForExport("c1", "chapters")?.id).toBe("c1");
  });

  it("resolves research items", () => {
    expect(chapterMetaForExport("r1", "research")?.id).toBe("r1");
  });

  it("returns undefined for wrong section", () => {
    expect(chapterMetaForExport("r1", "chapters")).toBeUndefined();
  });
});