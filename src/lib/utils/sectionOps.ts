import type { ChapterMeta, ChapterSection } from "$lib/types";

export type SectionLists = {
  chapters: ChapterMeta[];
  research: ChapterMeta[];
  characters: ChapterMeta[];
};

export function getSectionList(
  section: ChapterSection,
  lists: SectionLists,
): ChapterMeta[] {
  switch (section) {
    case "chapters":
      return lists.chapters;
    case "research":
      return lists.research;
    case "characters":
      return lists.characters;
  }
}

export function withSection<T>(
  section: ChapterSection,
  handlers: { [K in ChapterSection]: () => T },
): T {
  return handlers[section]();
}

export function mapSectionList(
  section: ChapterSection,
  lists: SectionLists,
  mapper: (list: ChapterMeta[]) => ChapterMeta[],
): SectionLists {
  return {
    chapters:
      section === "chapters" ? mapper(lists.chapters) : lists.chapters,
    research:
      section === "research" ? mapper(lists.research) : lists.research,
    characters:
      section === "characters" ? mapper(lists.characters) : lists.characters,
  };
}

export function findChapterSection(
  chapterId: string,
  lists: SectionLists,
): ChapterSection | null {
  if (lists.chapters.some((c) => c.id === chapterId)) return "chapters";
  if (lists.research.some((c) => c.id === chapterId)) return "research";
  if (lists.characters.some((c) => c.id === chapterId)) return "characters";
  return null;
}