import type { Editor } from "@tiptap/core";
import { chapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import { mindmapStore } from "$lib/stores/mindmap.svelte";
import { reviewStore } from "$lib/stores/review.svelte";
import type { AppSettings } from "$lib/utils/appSettings";
import type { ChapterSection } from "$lib/types";

export interface AppStoreBindings {
  settings: AppSettings;
  editorRef: Editor | null;
  showToast(msg: string): void;
  scheduleLibraryReviewTotalsRefresh(): void;
  openChapter(chapterId: string, section: ChapterSection): Promise<void>;
  showMindMap: boolean;
}

/** Wire domain stores to the app shell (toast, editor, chapter open). */
export function bindAppStores(app: AppStoreBindings): void {
  libraryStore.bindToast((msg) => app.showToast(msg));
  chapterStore.bindToast((msg) => app.showToast(msg));
  chapterStore.bindSettings(() => app.settings);
  chapterStore.bindEditor(() => app.editorRef);
  chapterStore.bindOnHtmlChange((html) => reviewStore.onHtmlUpdated(html));
  reviewStore.bindToast((msg) => app.showToast(msg));
  reviewStore.bindEditor(() => app.editorRef);
  reviewStore.bindReviewNames(() => ({
    author: app.settings.authorDisplayName,
    reviewer: app.settings.reviewerDisplayName,
  }));
  reviewStore.bindOnReviewChange(() => app.scheduleLibraryReviewTotalsRefresh());
  mindmapStore.bindToast((msg) => app.showToast(msg));
  mindmapStore.bindLibraryPath(() => libraryStore.library?.path ?? null);
  mindmapStore.bindOnOpenChapter((chapterId, section) =>
    app.openChapter(chapterId, section),
  );
  mindmapStore.bindCloseMindMap(() => {
    app.showMindMap = false;
  });
}