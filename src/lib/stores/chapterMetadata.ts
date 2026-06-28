import { chapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import {
  persistChapterStatus,
  persistChapterTitle,
} from "$lib/stores/libraryPersist";
import { getChapterTitle } from "$lib/utils/chapterTitle";
import type { ChapterSection, ChapterStatus } from "$lib/types";

export function setChaptersStatus(
  chapterIds: string[],
  status: ChapterStatus,
  section: ChapterSection = "chapters",
): void {
  for (const chapterId of chapterIds) {
    setChapterStatus(chapterId, status, section);
  }
}

export function setChapterStatus(
  chapterId: string,
  status: ChapterStatus,
  section: ChapterSection = "chapters",
): void {
  const prevStatus = libraryStore.getChapterStatus(chapterId, section);
  chapterStore.activeChapterMeta = libraryStore.setChapterStatus(
    chapterId,
    status,
    section,
    chapterStore.activeChapterMeta,
  );
  persistChapterStatus(
    libraryStore,
    chapterId,
    status,
    prevStatus,
    section,
    () => chapterStore.activeChapterMeta,
    (meta) => {
      chapterStore.activeChapterMeta = meta;
    },
  );
}

export function updateChapterTitle(
  chapterId: string,
  title: string,
  section: ChapterSection = "chapters",
): void {
  const prevTitle = getChapterTitle(chapterId, section);
  chapterStore.activeChapterMeta = libraryStore.updateChapterTitle(
    chapterId,
    title,
    section,
    chapterStore.activeChapterMeta,
  );
  persistChapterTitle(
    libraryStore,
    chapterId,
    title,
    prevTitle,
    section,
    () => chapterStore.activeChapterMeta,
    (meta) => {
      chapterStore.activeChapterMeta = meta;
    },
  );
}