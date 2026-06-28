import { libraryStore } from "$lib/stores/library.svelte";
import { getSectionList } from "$lib/utils/sectionOps";
import type { ChapterMeta, ChapterSection } from "$lib/types";

export function chapterMetaForExport(
  chapterId: string,
  section: ChapterSection,
): ChapterMeta | undefined {
  if (!libraryStore.library) return undefined;
  const lists = {
    chapters: libraryStore.library.chapters,
    research: libraryStore.researchChapters,
    characters: libraryStore.characterChapters,
  };
  return getSectionList(section, lists).find((c) => c.id === chapterId);
}

export function chapterMetasForExport(
  chapterIds: string[],
  section: ChapterSection,
): ChapterMeta[] {
  return chapterIds
    .map((id) => chapterMetaForExport(id, section))
    .filter((m): m is ChapterMeta => !!m);
}