import type { Editor } from "@tiptap/core";
import * as api from "$lib/api";
import { scrollToTextQuery } from "$lib/editor/navigation";
import type {
  AppScreen,
  ChapterContent,
  ChapterSection,
  SearchJumpTarget,
  SidebarTab,
} from "$lib/types";
import type { AppSettings } from "$lib/utils/appSettings";
import { htmlToPlain } from "$lib/utils/stats";
import { countWords } from "$lib/utils/wordCount";
import { chapterStore } from "./chapter.svelte";
import { libraryStore } from "./library.svelte";
import { reviewStore } from "./review.svelte";

/** Mutable workspace shell state orchestrated outside the monolithic app store. */
export interface WorkspaceHost {
  screen: AppScreen;
  settings: AppSettings;
  sidebarTab: SidebarTab;
  pendingSearchJump: SearchJumpTarget | null;
  editorRef: Editor | null;
  libraryReviewTotals: { openComments: number; pendingChanges: number } | null;
  libraryReviewTotalsLoading: boolean;
  reviewTotalsTimer: ReturnType<typeof setTimeout> | null;
  closeConfirmed: boolean;
  showQuickActions: boolean;
  showMindMap: boolean;
  showReadThrough: boolean;
  focusMode: boolean;
  focusChapterSearch: boolean;
  activeDialog: unknown;

  applySettings(next: AppSettings, opts?: { skipLibrarySync?: boolean }): void;
  setEditorRef(editor: Editor | null): void;
  showToast(msg: string): void;
  closeDialog(): void;
  refreshBookStats(): void | Promise<void>;
}

export async function createLibraryWorkspace(
  host: WorkspaceHost,
  path: string,
  name: string,
  _openChapter: (chapterId: string, section: ChapterSection) => Promise<void>,
): Promise<void> {
  await libraryStore.createLibrary(path, name);
  host.applySettings(libraryStore.mergeLibraryPreferences(host.settings), {
    skipLibrarySync: true,
  });
  host.screen = "workspace";
  host.sidebarTab = "chapters";
  const first = await libraryStore.newChapter(undefined, "chapters");
  if (first) {
    await openChapterFromContentWorkspace(host, first);
  }
}

export async function openLibraryWorkspace(
  host: WorkspaceHost,
  path: string,
  openChapter: (chapterId: string, section: ChapterSection) => Promise<void>,
): Promise<void> {
  const manifest = await libraryStore.openLibrary(path);
  host.applySettings(libraryStore.mergeLibraryPreferences(host.settings), {
    skipLibrarySync: true,
  });
  host.screen = "workspace";
  host.sidebarTab = "chapters";
  if (manifest.chapters.length > 0) {
    await openChapter(manifest.chapters[0].id, "chapters");
  } else if (libraryStore.researchChapters.length > 0) {
    await openChapter(libraryStore.researchChapters[0].id, "research");
  } else if (libraryStore.characterChapters.length > 0) {
    await openChapter(libraryStore.characterChapters[0].id, "characters");
  }
  void host.refreshBookStats();
  deferLibraryReviewTotals(host);
}

export function deferLibraryReviewTotals(host: WorkspaceHost): void {
  const run = () => void refreshLibraryReviewTotals(host);
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1500);
  }
}

export function scheduleLibraryReviewTotalsRefresh(host: WorkspaceHost): void {
  if (host.reviewTotalsTimer) clearTimeout(host.reviewTotalsTimer);
  host.reviewTotalsTimer = setTimeout(() => {
    host.reviewTotalsTimer = null;
    void refreshLibraryReviewTotals(host);
  }, 1200);
}

export async function refreshLibraryReviewTotals(host: WorkspaceHost): Promise<void> {
  const path = libraryStore.library?.path;
  if (!path) {
    host.libraryReviewTotals = null;
    host.libraryReviewTotalsLoading = false;
    return;
  }
  host.libraryReviewTotalsLoading = true;
  try {
    const summary = await api.getLibraryReviewSummary(path);
    host.libraryReviewTotals = {
      openComments: summary.totalOpenComments,
      pendingChanges: summary.totalPendingChanges,
    };
  } catch {
    host.libraryReviewTotals = null;
  } finally {
    host.libraryReviewTotalsLoading = false;
  }
}

export async function openChapterWorkspace(
  host: WorkspaceHost,
  chapterId: string,
  section: ChapterSection = "chapters",
): Promise<void> {
  if (!(await reviewStore.flushComments())) {
    host.showToast("Could not save comments — stay on current item");
    return;
  }
  const result = await chapterStore.openChapter(chapterId, section);
  if (!result) return;
  await reviewStore.tryLoadCommentsOnOpen(result.gen);
  scheduleSearchJumpApply(host);
}

/** Open a chapter we already have in memory (e.g. right after create). */
export async function openChapterFromContentWorkspace(
  host: WorkspaceHost,
  content: ChapterContent,
): Promise<void> {
  if (!(await reviewStore.flushComments())) {
    host.showToast("Could not save comments — stay on current item");
    return;
  }
  if (!(await chapterStore.prepareChapterSwitch())) return;
  const result = chapterStore.applyChapterContent(content);
  if (!result) return;
  await reviewStore.tryLoadCommentsOnOpen(result.gen);
  scheduleSearchJumpApply(host);
}

const SEARCH_JUMP_MAX_ATTEMPTS = 12;

export function scheduleSearchJumpApply(host: WorkspaceHost): void {
  if (!host.pendingSearchJump) return;
  let attempts = 0;
  const tryApply = () => {
    if (!host.pendingSearchJump) return;
    if (applyPendingSearchJump(host)) return;
    attempts++;
    if (attempts < SEARCH_JUMP_MAX_ATTEMPTS) {
      requestAnimationFrame(tryApply);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(tryApply));
}

export function applyPendingSearchJump(host: WorkspaceHost): boolean {
  const jump = host.pendingSearchJump;
  const editor = host.editorRef;
  if (!jump || !editor) return false;
  if (
    chapterStore.activeChapterId !== jump.chapterId ||
    chapterStore.activeSection !== jump.section
  ) {
    return false;
  }
  const ok = scrollToTextQuery(editor, jump.query, jump.matchIndex);
  if (ok) {
    host.pendingSearchJump = null;
    host.showToast("Jumped to match");
  }
  return ok;
}

export async function reloadActiveChapterWorkspace(
  content: ChapterContent,
): Promise<void> {
  const expectedId = chapterStore.activeChapterId;
  if (expectedId !== content.meta.id) return;

  chapterStore.activeChapterMeta = libraryStore.syncChapterInLists(
    content.meta,
    chapterStore.activeChapterMeta,
  );
  chapterStore.activeChapterHtml = content.html;
  chapterStore.pendingHtml = content.html;
  chapterStore.saveStatus = "saved";
  chapterStore.editorRevision++;
  const plain = htmlToPlain(content.html);
  chapterStore.wordCount = countWords(plain);
  chapterStore.charCount = plain.length;
  libraryStore.patchActiveChapterStats(
    chapterStore.activeChapterId,
    chapterStore.activeSection,
    chapterStore.wordCount,
    chapterStore.charCount,
  );
  if (chapterStore.activeChapterId !== expectedId) return;
  const gen = chapterStore.getOpenGeneration();
  await reviewStore.tryLoadCommentsOnOpen(gen);
}

export function goToWelcomeWorkspace(host: WorkspaceHost): void {
  if (libraryStore.library) void api.closeLibrary().catch(() => {});
  if (host.reviewTotalsTimer) clearTimeout(host.reviewTotalsTimer);
  host.reviewTotalsTimer = null;
  host.libraryReviewTotals = null;
  host.libraryReviewTotalsLoading = false;
  host.setEditorRef(null);
  chapterStore.reset();
  reviewStore.reset();
  libraryStore.reset();
  host.closeConfirmed = false;
  host.screen = "welcome";
  host.showQuickActions = false;
  host.showMindMap = false;
  host.showReadThrough = false;
  host.pendingSearchJump = null;
  host.activeDialog = null;
  host.focusMode = false;
  host.focusChapterSearch = false;
  host.sidebarTab = "chapters";
  reviewStore.showReviewPanel = false;
}