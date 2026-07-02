import * as api from "$lib/api";
import { libraryStore, type LibraryStore } from "$lib/stores/library.svelte";
import { reviewStore } from "$lib/stores/review.svelte";
import { chapterStore } from "$lib/stores/chapter.svelte";
import type { ChapterDeleteHost } from "$lib/stores/chapterDelete";
import { getChapterTitle } from "$lib/utils/chapterTitle";
import { formatError } from "$lib/utils/errors";
import { getSectionList } from "$lib/utils/sectionOps";
import type {
  ChapterContent,
  ChapterMeta,
  ChapterSection,
  ChapterStatus,
} from "$lib/types";
import { sidebarSelection } from "$lib/stores/sidebarSelection.svelte";
import { showConfirm, type ConfirmFlowSlice } from "./confirmFlow";

export interface ChapterOpsHost {
  library: { path: string } | null;
  activeChapterId: string | null;
  activeSection: ChapterSection;
  activeChapterMeta: ChapterMeta | null;
  showToast(msg: string): void;
  openChapterContent(content: ChapterContent): Promise<void>;
  deleteChapter(chapterId: string, section: ChapterSection): Promise<void>;
}

let chapterDeleteInFlight = false;

export async function newChapterWorkspace(
  host: ChapterOpsHost,
  title: string | undefined,
  section: ChapterSection,
): Promise<void> {
  if (!host.library) {
    host.showToast("Open a library first");
    return;
  }
  try {
    const content = await libraryStore.newChapter(title, section);
    if (!content) return;
    await host.openChapterContent(content);
  } catch (e) {
    host.showToast(formatError(e));
  }
}

export async function newCharacterWorkspace(host: ChapterOpsHost): Promise<void> {
  await newChapterWorkspace(host, "New Character", "characters");
}

export async function duplicateChapterWorkspace(
  host: ChapterOpsHost,
  chapterId: string,
  section: ChapterSection,
): Promise<void> {
  try {
    const content = await libraryStore.duplicateChapter(chapterId, section);
    if (content) await host.openChapterContent(content);
  } catch (e) {
    host.showToast(formatError(e));
  }
}

export async function duplicateActiveChapterWorkspace(host: ChapterOpsHost): Promise<void> {
  if (!host.library || !host.activeChapterId) return;
  await duplicateChapterWorkspace(host, host.activeChapterId, host.activeSection);
}

export function deleteActiveChapterWorkspace(
  host: ChapterOpsHost & ConfirmFlowSlice,
): void {
  if (!host.library || !host.activeChapterId || !host.activeChapterMeta) return;
  void requestChapterDeleteWorkspace(
    host,
    host.activeChapterId,
    host.activeSection,
    host.activeChapterMeta.title,
  );
}

export async function requestChapterDeleteWorkspace(
  host: ChapterOpsHost & ConfirmFlowSlice,
  chapterId: string,
  section: ChapterSection,
  title: string,
): Promise<void> {
  await requestChaptersDeleteWorkspace(host, [chapterId], section, [title]);
}

export async function requestChaptersDeleteWorkspace(
  host: ChapterOpsHost & ConfirmFlowSlice,
  chapterIds: string[],
  section: ChapterSection,
  titles?: string[],
): Promise<void> {
  const ids = [...new Set(chapterIds)].filter(Boolean);
  if (ids.length === 0) return;

  if (chapterDeleteInFlight) {
    host.showToast("Please wait — another delete is in progress");
    return;
  }

  const message =
    ids.length === 1
      ? `Delete "${titles?.[0] ?? "this chapter"}"? This cannot be undone.`
      : `Delete ${ids.length} chapters? This cannot be undone.`;

  const ok = await showConfirm(host, message, "Delete chapter", {
    confirm: "Delete",
    cancel: "Cancel",
    destructive: true,
  });
  if (!ok) return;

  chapterDeleteInFlight = true;
  try {
    if (ids.length === 1) {
      await host.deleteChapter(ids[0], section);
      return;
    }
    await deleteChaptersBulkWorkspace(
      host as unknown as ChapterOpsHost & ChapterDeleteHost,
      ids,
      section,
    );
  } catch (e) {
    host.showToast(formatError(e));
  } finally {
    chapterDeleteInFlight = false;
  }
}

async function deleteChaptersBulkWorkspace(
  host: ChapterOpsHost & ChapterDeleteHost,
  chapterIds: string[],
  section: ChapterSection,
): Promise<void> {
  if (!host.library) return;

  const lists = {
    chapters: libraryStore.library?.chapters ?? [],
    research: libraryStore.researchChapters,
    characters: libraryStore.characterChapters,
  };
  const list = getSectionList(section, lists);
  const idSet = new Set(chapterIds);
  const sorted = [...chapterIds].sort(
    (a, b) => list.findIndex((c) => c.id === b) - list.findIndex((c) => c.id === a),
  );

  const activeInSet =
    !!host.activeChapterId &&
    host.activeSection === section &&
    idSet.has(host.activeChapterId);

  let nextId: string | undefined;
  if (activeInSet && host.activeChapterId) {
    const idx = list.findIndex((c) => c.id === host.activeChapterId);
    for (let i = idx + 1; i < list.length; i++) {
      if (!idSet.has(list[i].id)) {
        nextId = list[i].id;
        break;
      }
    }
    if (!nextId) {
      for (let i = idx - 1; i >= 0; i--) {
        if (!idSet.has(list[i].id)) {
          nextId = list[i].id;
          break;
        }
      }
    }
  }

  chapterStore.cancelPendingOpen();
  host.cancelChapterOpenQueue();

  if (activeInSet) {
    if (!(await reviewStore.flushComments())) {
      host.showToast("Could not save comments — delete cancelled");
      return;
    }
  } else {
    reviewStore.discardPendingCommentSave();
  }

  for (const id of sorted) {
    chapterStore.abortSavesForDeletedChapter(id, section);
    try {
      await libraryStore.deleteChapter(id, section);
    } catch (e) {
      host.showToast(formatError(e));
      return;
    }
  }

  host.showToast(`Deleted ${sorted.length} chapters`);
  sidebarSelection.clear();

  if (!activeInSet) return;

  if (nextId) {
    await host.openChapter(nextId, section);
    return;
  }

  host.setEditor(null);
  chapterStore.clearActiveChapter();
  reviewStore.clearChapterCommentsState();
}

export async function duplicateChaptersWorkspace(
  host: ChapterOpsHost,
  chapterIds: string[],
  section: ChapterSection,
): Promise<void> {
  const ids = [...new Set(chapterIds)].filter(Boolean);
  if (ids.length === 0) return;

  try {
    let last: ChapterContent | null = null;
    for (const id of ids) {
      last = await libraryStore.duplicateChapter(id, section);
    }
    if (!last) return;
    if (ids.length === 1) {
      await host.openChapterContent(last);
    } else {
      host.showToast(`Duplicated ${ids.length} chapters`);
    }
  } catch (e) {
    host.showToast(formatError(e));
  }
}

// --- Chapter metadata (status / title) ---
// Optimistic update in the stores, then persist; roll back on failure.

function persistChapterStatus(
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

function persistChapterTitle(
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

