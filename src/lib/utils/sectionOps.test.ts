import { describe, expect, it } from "vitest";
import {
  findChapterSection,
  getSectionList,
  mapSectionList,
  withSection,
} from "./sectionOps";
import type { ChapterMeta } from "$lib/types";

const meta = (id: string, _section: string): ChapterMeta => ({
  id,
  title: id,
  status: "draft",
  order: 0,
  updatedAt: "",
});

const lists = {
  chapters: [meta("c1", "chapters")],
  research: [meta("r1", "research")],
  characters: [meta("x1", "characters")],
};

describe("sectionOps", () => {
  it("getSectionList returns the correct list", () => {
    expect(getSectionList("research", lists).map((c) => c.id)).toEqual(["r1"]);
  });

  it("withSection dispatches by section", () => {
    expect(
      withSection("characters", {
        chapters: () => "c",
        research: () => "r",
        characters: () => "x",
      }),
    ).toBe("x");
  });

  it("mapSectionList updates only the target section", () => {
    const next = mapSectionList("research", lists, (list) => [
      ...list,
      meta("r2", "research"),
    ]);
    expect(next.research).toHaveLength(2);
    expect(next.chapters).toHaveLength(1);
    expect(next.characters).toHaveLength(1);
  });

  it("findChapterSection locates chapter id", () => {
    expect(findChapterSection("x1", lists)).toBe("characters");
    expect(findChapterSection("missing", lists)).toBeNull();
  });
});