import type { Editor } from "@tiptap/core";
import { chapterStore, splitChapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import { reviewStore } from "$lib/stores/review.svelte";
import type { ChapterSection } from "$lib/types";
import { formatError } from "$lib/utils/errors";
import { getSectionList } from "$lib/utils/sectionOps";

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

export interface ChapterDeleteHost {
  setEditor(editor: Editor | null): void;
  showToast(msg: string): void;
  openChapter(chapterId: string, section: ChapterSection): Promise<void>;
  cancelChapterOpenQueue(): void;
}

export async function deleteChapterWorkspace(
  chapterId: string,
  section: ChapterSection,
  host: ChapterDeleteHost,
): Promise<void> {
  chapterStore.cancelPendingOpen();
  host.cancelChapterOpenQueue();

  const wasActive =
    chapterStore.activeChapterId === chapterId &&
    chapterStore.activeSection === section;
  const wasSplit =
    splitChapterStore.activeChapterId === chapterId &&
    splitChapterStore.activeSection === section;

  const nextId = wasActive ? nextChapterIdAfterDelete(chapterId, section) : undefined;

  if (wasActive) {
    if (!(await reviewStore.flushComments())) {
      host.showToast("Could not save comments — delete cancelled");
      return;
    }
  } else {
    reviewStore.discardPendingCommentSave();
  }

  chapterStore.abortSavesForDeletedChapter(chapterId, section);
  if (wasSplit) {
    splitChapterStore.abortSavesForDeletedChapter(chapterId, section);
    splitChapterStore.clearActiveChapter();
  }

  try {
    await libraryStore.deleteChapter(chapterId, section);
  } catch (e) {
    host.showToast(formatError(e));
    return;
  }
  host.showToast("Deleted");

  if (!wasActive) return;

  if (nextId) {
    await host.openChapter(nextId, section);
    return;
  }

  host.setEditor(null);
  chapterStore.clearActiveChapter();
  reviewStore.clearChapterCommentsState();
}