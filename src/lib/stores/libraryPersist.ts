import * as api from "$lib/api";
import { formatError } from "$lib/utils/errors";
import type { ChapterMeta, ChapterSection, ChapterStatus } from "$lib/types";
import type { LibraryStore } from "./library.svelte";

export function persistChapterStatus(
  store: LibraryStore,
  chapterId: string,
  status: ChapterStatus,
  prevStatus: ChapterStatus | null,
  section: ChapterSection,
  getActive: () => ChapterMeta | null,
  setActive: (meta: ChapterMeta | null) => void,
): void {
  if (!store.library) return;
  void api
    .updateChapterStatus(store.library.path, chapterId, status, section)
    .then((updated) => {
      setActive(store.syncChapterInLists(updated, getActive()));
    })
    .catch((e) => {
      if (prevStatus) {
        setActive(store.setChapterStatus(chapterId, prevStatus, section, getActive()));
      }
      store.error = formatError(e);
      store.showToast(formatError(e));
    });
}

export function persistChapterTitle(
  store: LibraryStore,
  chapterId: string,
  title: string,
  prevTitle: string | null,
  section: ChapterSection,
  getActive: () => ChapterMeta | null,
  setActive: (meta: ChapterMeta | null) => void,
): void {
  if (!store.library) return;
  void api
    .updateChapterTitle(store.library.path, chapterId, title, section)
    .then((updated) => {
      setActive(store.syncChapterInLists(updated, getActive()));
    })
    .catch((e) => {
      if (prevTitle) {
        setActive(store.updateChapterTitle(chapterId, prevTitle, section, getActive()));
      }
      store.error = formatError(e);
      store.showToast(formatError(e));
    });
}