import type { Editor } from "@tiptap/core";
import { chapterStore, splitChapterStore } from "$lib/stores/chapter.svelte";
import { exportStore } from "$lib/stores/export.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import { reviewStore } from "$lib/stores/review.svelte";

import { applyAppSettings } from "$lib/stores/applyAppSettings";
import { bindAppStores } from "$lib/stores/bindAppStores";
import { deleteChapterWorkspace } from "$lib/stores/chapterDelete";
import {
  setChapterStatus as applyChapterStatus,
  setChaptersStatus as applyChaptersStatus,
  updateChapterTitle as applyChapterTitle,
} from "$lib/stores/chapterMetadata";
import { ChapterOpenQueue } from "$lib/stores/chapterQueue";
import {
  guardUnsavedChanges,
  resolveConfirmSlice,
  showConfirm,
  tryCloseAppConfirm,
} from "$lib/stores/confirmFlow";
import {
  deleteActiveChapterWorkspace,
  duplicateActiveChapterWorkspace,
  duplicateChapterWorkspace,
  duplicateChaptersWorkspace,
  newChapterWorkspace,
  newCharacterWorkspace,
  requestChapterDeleteWorkspace,
  requestChaptersDeleteWorkspace,
} from "$lib/stores/chapterOps";
import { getAppSettings, type AppSettings } from "$lib/utils/appSettings";
import {
  applyPendingSearchJump,
  createLibraryWorkspace,
  goToWelcomeWorkspace,
  openChapterFromContentWorkspace,
  openSplitChapterWorkspace,
  openChapterWorkspace,
  openLibraryWorkspace,
  reloadActiveChapterWorkspace,
  refreshLibraryReviewTotals,
  scheduleLibraryReviewTotalsRefresh,
  scheduleSearchJumpApply,
} from "$lib/stores/workspace";
import { pickDefaultSplitChapter } from "$lib/utils/splitView";
import type {
  ActiveDialog,
  AppMode,
  AppScreen,
  BookSettings,
  ChapterComments,
  ChapterContent,
  ChapterSection,
  ChapterStats,
  ChapterStatus,
  CommentThread,
  CompileOptions,
  ConfirmDialogState,
  ExportFormat,
  LibraryManifest,
  LibrarySearchHit,
  SearchJumpTarget,
  SidebarTab,
  TrackedChange,
} from "$lib/types";

class AppStore {
  screen = $state<AppScreen>("welcome");
  settings = $state<AppSettings>(getAppSettings());
  confirmDialog = $state<ConfirmDialogState | null>(null);
  confirmGeneration = $state(0);
  mode = $state<AppMode>("author");
  sidebarTab = $state<SidebarTab>("chapters");
  sidebarCollapsed = $state(false);
  sidebarWidth = $state(getAppSettings().sidebarWidth);
  splitRatio = $state(getAppSettings().splitRatio);
  renameChapterTargetId = $state<string | null>(null);
  renameChapterSection = $state<ChapterSection>("chapters");
  focusMode = $state(false);
  splitViewEnabled = $state(false);
  focusedPane = $state<"primary" | "secondary">("primary");
  activeDialog = $state<ActiveDialog>(null);
  showQuickActions = $state(false);
  showMindMap = $state(false);
  showReadThrough = $state(false);
  showReviewPanel = $state(false);
  readThroughFinalOnly = $state(true);
  pendingSearchJump = $state<SearchJumpTarget | null>(null);
  libraryReviewTotals = $state<{ openComments: number; pendingChanges: number } | null>(
    null,
  );
  libraryReviewTotalsLoading = $state(false);

  reviewTotalsTimer: ReturnType<typeof setTimeout> | null = null;
  spellcheck = $state(getAppSettings().spellcheck);
  toast = $state<string | null>(null);
  focusChapterSearch = $state(false);
  editorRef = $state<Editor | null>(null);
  splitEditorRef = $state<Editor | null>(null);

  confirmResolver: ((ok: boolean) => void) | null = null;
  private readonly chapterOpenQueue = new ChapterOpenQueue();
  closeConfirmed = false;
  private sidebarBeforeFocus = false;

  constructor() {
    bindAppStores(this);
  }

  // --- Library (delegated) ---
  get library(): LibraryManifest | null {
    return libraryStore.library;
  }
  set library(v: LibraryManifest | null) {
    libraryStore.library = v;
  }
  get researchChapters() {
    return libraryStore.researchChapters;
  }
  get characterChapters() {
    return libraryStore.characterChapters;
  }
  get researchFilter() {
    return libraryStore.researchFilter;
  }
  set researchFilter(v: string) {
    libraryStore.researchFilter = v;
  }
  get characterFilter() {
    return libraryStore.characterFilter;
  }
  set characterFilter(v: string) {
    libraryStore.characterFilter = v;
  }
  get chapterFilter() {
    return libraryStore.chapterFilter;
  }
  set chapterFilter(v: string) {
    libraryStore.chapterFilter = v;
  }
  get bookSettings(): BookSettings {
    return libraryStore.bookSettings;
  }
  get chapterStats(): Record<string, ChapterStats> {
    return libraryStore.chapterStats;
  }
  get error() {
    return libraryStore.error;
  }
  set error(v: string | null) {
    libraryStore.error = v;
  }
  get filteredResearch() {
    return libraryStore.filteredResearch;
  }
  get filteredChapters() {
    return libraryStore.filteredChapters;
  }
  get filteredCharacters() {
    return libraryStore.filteredCharacters;
  }
  get finalChapters() {
    return libraryStore.finalChapters;
  }

  // --- Chapter (delegated) ---
  get activeChapterId() {
    return chapterStore.activeChapterId;
  }
  get activeSection() {
    return chapterStore.activeSection;
  }
  get activeChapterMeta() {
    return chapterStore.activeChapterMeta;
  }
  get activeChapterHtml() {
    return chapterStore.activeChapterHtml;
  }
  get saveStatus() {
    return chapterStore.saveStatus;
  }
  get wordCount() {
    return chapterStore.wordCount;
  }
  get editorRevision() {
    return chapterStore.editorRevision;
  }
  get hasUnsavedChanges() {
    return (
      chapterStore.hasUnsavedChanges ||
      (this.splitViewEnabled && splitChapterStore.hasUnsavedChanges)
    );
  }

  get activeEditorRef(): Editor | null {
    if (this.splitViewEnabled && this.focusedPane === "secondary") {
      return this.splitEditorRef;
    }
    return this.editorRef;
  }

  get splitChapterId() {
    return splitChapterStore.activeChapterId;
  }
  get splitSection() {
    return splitChapterStore.activeSection;
  }
  get splitChapterMeta() {
    return splitChapterStore.activeChapterMeta;
  }
  get splitChapterHtml() {
    return splitChapterStore.activeChapterHtml;
  }
  get splitEditorRevision() {
    return splitChapterStore.editorRevision;
  }
  get chapterCharCount() {
    return chapterStore.chapterCharCount;
  }
  get chapterPages() {
    return chapterStore.chapterPages;
  }

  // --- Review (delegated) ---
  get chapterComments(): ChapterComments {
    return reviewStore.chapterComments;
  }
  get trackChanges() {
    return reviewStore.trackChanges;
  }
  get showEditsComments() {
    return reviewStore.showEditsComments;
  }
  get pendingCommentAnchor() {
    return reviewStore.pendingCommentAnchor;
  }
  get pendingCommentMarkId() {
    return reviewStore.pendingCommentMarkId;
  }
  get pendingChanges(): TrackedChange[] {
    return reviewStore.pendingChanges;
  }
  get activeThreads(): CommentThread[] {
    return reviewStore.activeThreads;
  }

  // --- Export (delegated) ---
  get compileFormat() {
    return exportStore.compileFormat;
  }
  set compileFormat(v: ExportFormat | null) {
    exportStore.compileFormat = v;
  }
  get exportFormat() {
    return exportStore.exportFormat;
  }
  set exportFormat(v: ExportFormat | null) {
    exportStore.exportFormat = v;
  }

  requestChapterSearchFocus() {
    this.sidebarCollapsed = false;
    this.sidebarTab = "chapters";
    this.focusChapterSearch = true;
  }

  async refreshBookStats() {
    await libraryStore.refreshBookStats(
      chapterStore.activeChapterId,
      chapterStore.activeSection,
      chapterStore.pendingHtml,
      chapterStore.activeChapterHtml,
    );
  }

  openDialog(dialog: ActiveDialog) {
    this.activeDialog = dialog;
  }

  closeDialog() {
    if (this.activeDialog === "addComment" && this.pendingCommentMarkId) {
      reviewStore.cancelPendingComment();
    }
    this.activeDialog = null;
    this.renameChapterTargetId = null;
  }

  setSidebarWidth(width: number) {
    this.sidebarWidth = Math.max(200, Math.min(480, Math.round(width)));
  }

  commitSidebarWidth() {
    if (this.settings.sidebarWidth === this.sidebarWidth) return;
    this.applySettings({ ...this.settings, sidebarWidth: this.sidebarWidth });
  }

  setSplitRatio(ratio: number) {
    this.splitRatio = Math.max(0.22, Math.min(0.78, ratio));
  }

  commitSplitRatio() {
    if (this.settings.splitRatio === this.splitRatio) return;
    this.applySettings({ ...this.settings, splitRatio: this.splitRatio });
  }

  openRenameForChapter(chapterId: string, section: ChapterSection = "chapters") {
    this.renameChapterTargetId = chapterId;
    this.renameChapterSection = section;
    this.openDialog("renameChapter");
  }

  toggleQuickActions() {
    this.showQuickActions = !this.showQuickActions;
  }

  showToast(msg: string) {
    this.toast = msg;
    setTimeout(() => {
      if (this.toast === msg) this.toast = null;
    }, 2500);
  }

  toggleTrackChanges() {
    reviewStore.toggleTrackChanges();
  }

  setEditor(editor: Editor | null) {
    this.editorRef = editor;
    if (editor) {
      reviewStore.attachEditor(editor);
      this.scheduleSearchJumpApply();
    }
  }

  setSplitEditor(editor: Editor | null) {
    this.splitEditorRef = editor;
  }

  focusPane(pane: "primary" | "secondary") {
    this.focusedPane = pane;
  }

  scheduleSplitAutoSave(editor: Editor) {
    splitChapterStore.scheduleAutoSave(editor);
  }

  async toggleSplitView() {
    if (this.splitViewEnabled) {
      if (!(await splitChapterStore.prepareChapterSwitch())) return;
      splitChapterStore.clearActiveChapter();
      this.splitEditorRef = null;
      this.splitViewEnabled = false;
      this.focusedPane = "primary";
      return;
    }
    this.focusedPane = "primary";
    const pick = pickDefaultSplitChapter();
    if (pick) {
      await openSplitChapterWorkspace(pick.chapterId, pick.section);
    }
    this.splitViewEnabled = true;
  }

  async openChapterInSplit(chapterId: string, section: ChapterSection = "chapters") {
    const enabling = !this.splitViewEnabled;
    this.focusedPane = "secondary";
    await openSplitChapterWorkspace(chapterId, section);
    if (enabling) this.splitViewEnabled = true;
  }

  addCommentOnSelection(selectionFrom?: number, selectionTo?: number) {
    const markId = reviewStore.addCommentOnSelection(selectionFrom, selectionTo);
    if (markId) this.openDialog("addComment");
  }

  async loadChapterComments() {
    await reviewStore.loadChapterComments();
  }

  scheduleSaveComments() {
    reviewStore.scheduleSaveComments();
  }

  async saveChapterComments() {
    await reviewStore.saveChapterComments();
  }

  async addComment(text: string, markId: string) {
    await reviewStore.addComment(text, markId);
  }

  async replyToThread(threadId: string, text: string) {
    await reviewStore.replyToThread(threadId, text);
  }

  async resolveThread(threadId: string) {
    await reviewStore.resolveThread(threadId);
  }

  applyChange(change: TrackedChange, action: "accept" | "reject") {
    reviewStore.applyChange(change, action);
  }

  acceptAllChanges() {
    reviewStore.acceptAllChanges();
  }

  rejectAllChanges() {
    reviewStore.rejectAllChanges();
  }

  scrollToComment(markId: string) {
    reviewStore.scrollToComment(markId);
  }

  scrollToChange(markId: string) {
    reviewStore.scrollToChange(markId);
  }

  toggleSpellcheck() {
    this.applySettings({ ...this.settings, spellcheck: !this.settings.spellcheck });
  }

  toggleShowEdits() {
    reviewStore.toggleShowEdits();
  }

  async loadBookSettings() {
    await libraryStore.loadBookSettings();
  }

  async saveBookSettings(settings: BookSettings) {
    await libraryStore.saveBookSettings(settings);
  }

  compileBook(options: CompileOptions) {
    return exportStore.compileBook(options);
  }

  exportChapter(format: ExportFormat) {
    return exportStore.exportChapter(format);
  }

  exportChapters(
    chapterIds: string[],
    format: ExportFormat,
    combined: boolean,
    outputDir?: string,
    filename?: string,
    style?: string,
    section?: import("$lib/types").ChapterSection,
  ) {
    return exportStore.exportChapters(
      chapterIds,
      format,
      combined,
      outputDir,
      filename,
      style,
      section,
    );
  }

  async createLibrary(path: string, name: string) {
    await createLibraryWorkspace(this, path, name, (id, section) =>
      this.openChapter(id, section),
    );
  }

  async requestOpenLibrary(path: string) {
    await this.guardUnsaved(async () => {
      await this.openLibrary(path);
    });
  }

  async requestCreateLibrary(path: string, name: string) {
    await this.guardUnsaved(async () => {
      await this.createLibrary(path, name);
    });
  }

  async openLibrary(path: string) {
    await openLibraryWorkspace(this, path, (id, section) => this.openChapter(id, section));
  }

  scheduleLibraryReviewTotalsRefresh() {
    scheduleLibraryReviewTotalsRefresh(this);
  }

  async refreshLibraryReviewTotals() {
    await refreshLibraryReviewTotals(this);
  }

  setEditorRef(editor: Editor | null) {
    this.setEditor(editor);
  }

  async importCustomFont() {
    await libraryStore.importCustomFont();
  }

  async newChapter(title?: string, section: ChapterSection = "chapters") {
    await newChapterWorkspace(this, title, section);
  }

  async newCharacter(title?: string) {
    if (title) {
      await newChapterWorkspace(this, title, "characters");
    } else {
      await newCharacterWorkspace(this);
    }
  }

  async openChapter(chapterId: string, section: ChapterSection = "chapters") {
    return this.chapterOpenQueue.enqueue(async () => {
      if (this.splitViewEnabled && this.focusedPane === "secondary") {
        await openSplitChapterWorkspace(chapterId, section);
        return;
      }
      await openChapterWorkspace(this, chapterId, section);
    });
  }

  async openChapterContent(content: ChapterContent) {
    return this.chapterOpenQueue.enqueue(() =>
      openChapterFromContentWorkspace(this, content),
    );
  }

  cancelChapterOpenQueue() {
    this.chapterOpenQueue.cancel();
  }

  openChapterFromSearch(hit: LibrarySearchHit, query: string) {
    this.pendingSearchJump = {
      chapterId: hit.chapterId,
      section: hit.section,
      query: query.trim(),
      matchIndex: hit.matchIndex,
    };
    this.closeDialog();
    void this.openChapter(hit.chapterId, hit.section);
  }

  openChapterFromReview(
    chapterId: string,
    section: ChapterSection = "chapters",
  ) {
    this.closeDialog();
    void this.openChapter(chapterId, section);
  }

  scheduleSearchJumpApply() {
    scheduleSearchJumpApply(this);
  }

  applyPendingSearchJump(): boolean {
    return applyPendingSearchJump(this);
  }

  toggleReadThrough() {
    this.showReadThrough = !this.showReadThrough;
    if (this.showReadThrough) {
      this.showMindMap = false;
      this.focusMode = false;
    }
  }

  scheduleAutoSave(editor: Editor) {
    chapterStore.scheduleAutoSave(editor);
  }

  flushSave() {
    return chapterStore.flushSave();
  }

  async reloadActiveChapter(content: ChapterContent) {
    await reloadActiveChapterWorkspace(content);
  }

  async saveAll() {
    await chapterStore.saveAll();
    if (this.splitViewEnabled) {
      await splitChapterStore.saveAll();
    }
  }

  deleteActiveChapter() {
    deleteActiveChapterWorkspace(this);
  }

  async requestChapterDelete(
    chapterId: string,
    section: ChapterSection,
    title: string,
  ) {
    await requestChapterDeleteWorkspace(this, chapterId, section, title);
  }

  async requestChaptersDelete(
    chapterIds: string[],
    section: ChapterSection,
    titles?: string[],
  ) {
    await requestChaptersDeleteWorkspace(this, chapterIds, section, titles);
  }

  async deleteChapter(chapterId: string, section: ChapterSection = "chapters") {
    await deleteChapterWorkspace(chapterId, section, this);
  }

  async duplicateActiveChapter() {
    await duplicateActiveChapterWorkspace(this);
  }

  async duplicateChapter(chapterId: string, section: ChapterSection = "chapters") {
    await duplicateChapterWorkspace(this, chapterId, section);
  }

  async duplicateChapters(chapterIds: string[], section: ChapterSection = "chapters") {
    await duplicateChaptersWorkspace(this, chapterIds, section);
  }

  setChapterStatus(
    chapterId: string,
    status: ChapterStatus,
    section: ChapterSection = "chapters",
  ) {
    applyChapterStatus(chapterId, status, section);
  }

  setChaptersStatus(
    chapterIds: string[],
    status: ChapterStatus,
    section: ChapterSection = "chapters",
  ) {
    applyChaptersStatus(chapterIds, status, section);
  }

  reorderChapters(chapterIds: string[], section: ChapterSection = "chapters") {
    libraryStore.reorderChapters(chapterIds, section);
  }

  updateChapterTitle(
    chapterId: string,
    title: string,
    section: ChapterSection = "chapters",
  ) {
    applyChapterTitle(chapterId, title, section);
  }

  applySettings(
    next: AppSettings,
    opts?: { skipLibrarySync?: boolean },
  ) {
    applyAppSettings(this, next, opts);
  }

  async confirm(
    message: string,
    title = "Unsaved changes",
    labels?: { confirm?: string; cancel?: string; destructive?: boolean },
  ): Promise<boolean> {
    return showConfirm(this, message, title, labels);
  }

  resolveConfirm(ok: boolean) {
    resolveConfirmSlice(this, ok);
  }

  async guardUnsaved(action: () => void | Promise<void>) {
    await guardUnsavedChanges(
      this,
      this.hasUnsavedChanges,
      this.settings.confirmOnClose,
      action,
    );
  }

  async tryCloseApp(): Promise<boolean> {
    return tryCloseAppConfirm(this, {
      closeConfirmed: this.closeConfirmed,
      hasUnsaved: this.hasUnsavedChanges,
      confirmOnClose: this.settings.confirmOnClose,
      onConfirmed: () => {
        this.closeConfirmed = true;
        chapterStore.discardUnsaved();
        splitChapterStore.discardUnsaved();
      },
    });
  }

  async requestCloseLibrary() {
    await this.guardUnsaved(() => this.goToWelcome());
  }

  async refreshResearch() {
    await libraryStore.refreshResearch();
  }

  async refreshCharacters() {
    await libraryStore.refreshCharacters();
  }

  openReviewPanel() {
    this.showReviewPanel = true;
  }

  toggleReviewPanel() {
    this.showReviewPanel = !this.showReviewPanel;
  }

  setMode(mode: AppMode) {
    this.mode = mode;
    this.showReviewPanel = mode === "editor";
    reviewStore.setMode(mode);
  }

  toggleFocusMode() {
    if (!this.focusMode) {
      this.sidebarBeforeFocus = this.sidebarCollapsed;
      this.showMindMap = false;
      this.showReadThrough = false;
      if (this.splitViewEnabled) void this.toggleSplitView();
      this.focusMode = true;
    } else {
      this.focusMode = false;
      this.sidebarCollapsed = this.sidebarBeforeFocus;
    }
  }

  toggleMindMap() {
    this.showMindMap = !this.showMindMap;
  }

  goToWelcome() {
    goToWelcomeWorkspace(this);
  }
}

export const app = new AppStore();