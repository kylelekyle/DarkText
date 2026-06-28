import { getSectionList } from "$lib/utils/sectionOps";
import type { ChapterSection } from "$lib/types";
import { libraryStore } from "$lib/stores/library.svelte";

export function getChapterTitle(
  chapterId: string,
  section: ChapterSection,
): string | null {
  if (!libraryStore.library) return null;
  const lists = {
    chapters: libraryStore.library.chapters,
    research: libraryStore.researchChapters,
    characters: libraryStore.characterChapters,
  };
  return getSectionList(section, lists).find((c) => c.id === chapterId)?.title ?? null;
}