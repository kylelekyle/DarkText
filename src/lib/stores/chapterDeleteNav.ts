import { libraryStore } from "$lib/stores/library.svelte";
import { getSectionList } from "$lib/utils/sectionOps";
import type { ChapterSection } from "$lib/types";

/** Pick the next item to open after deleting `deletedId` from `section`. */
export function nextChapterIdAfterDelete(
  deletedId: string,
  section: ChapterSection,
): string | undefined {
  if (!libraryStore.library) return undefined;

  const lists = {
    chapters: libraryStore.library.chapters,
    research: libraryStore.researchChapters,
    characters: libraryStore.characterChapters,
  };
  const list = getSectionList(section, lists);
  const idx = list.findIndex((c) => c.id === deletedId);
  if (idx < 0) return list.find((c) => c.id !== deletedId)?.id;

  const after = list[idx + 1]?.id;
  const before = list[idx - 1]?.id;
  return after ?? before;
}