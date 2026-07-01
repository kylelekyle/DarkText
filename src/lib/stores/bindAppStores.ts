import type { Editor } from "@tiptap/core";
import { chapterStore, splitChapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import { reviewStore } from "$lib/stores/review.svelte";
import type { AppSettings } from "$lib/utils/appSettings";

export interface AppStoreBindings {
  settings: AppSettings;
  editorRef: Editor | null;
  splitEditorRef: Editor | null;
  showToast(msg: string): void;
  scheduleLibraryReviewTotalsRefresh(): void;
}

/** Wire domain stores to the app shell (toast, editor, chapter open). */
export function bindAppStores(app: AppStoreBindings): void {
  libraryStore.bindToast((msg) => app.showToast(msg));
  chapterStore.bindToast((msg) => app.showToast(msg));
  chapterStore.bindSettings(() => app.settings);
  chapterStore.bindEditor(() => app.editorRef);
  chapterStore.bindOnHtmlChange((html) => reviewStore.onHtmlUpdated(html));
  splitChapterStore.bindToast((msg) => app.showToast(msg));
  splitChapterStore.bindSettings(() => app.settings);
  splitChapterStore.bindEditor(() => app.splitEditorRef);
  reviewStore.bindToast((msg) => app.showToast(msg));
  reviewStore.bindEditor(() => app.editorRef);
  reviewStore.bindReviewNames(() => ({
    author: app.settings.authorDisplayName,
    reviewer: app.settings.reviewerDisplayName,
  }));
  reviewStore.bindOnReviewChange(() => app.scheduleLibraryReviewTotalsRefresh());
}