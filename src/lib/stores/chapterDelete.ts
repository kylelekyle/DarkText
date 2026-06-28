import type { Editor } from "@tiptap/core";
import { chapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import { reviewStore } from "$lib/stores/review.svelte";
import { nextChapterIdAfterDelete } from "$lib/stores/chapterDeleteNav";
import type { ChapterSection } from "$lib/types";
import { formatError } from "$lib/utils/errors";

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