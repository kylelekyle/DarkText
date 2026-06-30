import type { Editor } from "@tiptap/core";
import * as api from "$lib/api";
import {
  applyChangeInEditor,
  collectCommentMarkIdsFromEditor,
  syncChangesFromEditor,
  syncChangesFromHtml,
} from "$lib/editor/review";
import { trackedChangesDiffer } from "$lib/editor/reviewChanges";
import { scrollToChange, scrollToComment } from "$lib/editor/navigation";
import { setTrackChangesEnabled } from "$lib/editor/trackChanges";
import { libraryStore } from "$lib/stores/library.svelte";
import { chapterStore } from "$lib/stores/chapter.svelte";
import { formatError } from "$lib/utils/errors";
import type {
  AppMode,
  ChapterComments,
  CommentThread,
  TrackedChange,
} from "$lib/types";

export type ReviewToast = (msg: string) => void;

export class ReviewStore {
  chapterComments = $state<ChapterComments>({ threads: [], changes: [] });
  /** MarkIds with a comment span in the current editor document (for panel filtering + undo). */
  commentMarkIdsInDoc = $state<ReadonlySet<string>>(new Set());
  trackChanges = $state(false);
  showEditsComments = $state(true);
  showReviewPanel = $state(false);
  pendingCommentAnchor = $state("");
  pendingCommentMarkId = $state("");

  private commentsTimer: ReturnType<typeof setTimeout> | null = null;
  private commentsPendingSave = false;
  private commentsSaveInFlight = false;
  private commentsSaveGen = 0;
  private toast: ReviewToast = () => {};
  private getEditor: () => Editor | null = () => null;
  private getAuthorName: () => string = () => "Author";
  private getReviewerName: () => string = () => "Editor";
  private onReviewChange: () => void = () => {};

  bindToast(fn: ReviewToast) {
    this.toast = fn;
  }

  bindEditor(getter: () => Editor | null) {
    this.getEditor = getter;
  }

  /** Re-apply tracking flag and reconcile the panel when a new editor instance mounts. */
  attachEditor(editor: Editor | null) {
    if (!editor || editor.isDestroyed) return;
    setTrackChangesEnabled(editor, this.trackChanges);
    this.syncCommentMarksFromEditor(editor);
    if (this.trackChanges || this.chapterComments.changes.length > 0) {
      const changes = syncChangesFromEditor(editor, this.chapterComments.changes);
      this.chapterComments = { ...this.chapterComments, changes };
    }
  }

  bindReviewNames(getter: () => { author: string; reviewer: string }) {
    this.getAuthorName = () => getter().author;
    this.getReviewerName = () => getter().reviewer;
  }

  bindOnReviewChange(fn: () => void) {
    this.onReviewChange = fn;
  }

  private notifyReviewChange() {
    this.onReviewChange();
  }

  get pendingChanges(): TrackedChange[] {
    return this.chapterComments.changes.filter((c) => c.status === "pending");
  }

  get activeThreads(): CommentThread[] {
    return this.chapterComments.threads.filter(
      (t) => !t.resolved && this.commentMarkIdsInDoc.has(t.markId),
    );
  }

  syncCommentMarksFromEditor(editor?: Editor | null) {
    const ed = editor ?? this.getEditor();
    this.commentMarkIdsInDoc = ed
      ? collectCommentMarkIdsFromEditor(ed)
      : new Set();
  }

  reset() {
    if (this.commentsTimer) clearTimeout(this.commentsTimer);
    this.commentsTimer = null;
    this.commentsPendingSave = false;
    this.commentsSaveInFlight = false;
    this.commentsSaveGen = 0;
    this.chapterComments = { threads: [], changes: [] };
    this.commentMarkIdsInDoc = new Set();
    this.trackChanges = false;
    setTrackChangesEnabled(this.getEditor(), false);
    this.showReviewPanel = false;
    this.pendingCommentAnchor = "";
    this.pendingCommentMarkId = "";
  }

  /** Turn on tracking for review edits without toggling off later. */
  enableTrackChanges(editor?: Editor | null) {
    if (this.trackChanges) return;
    this.trackChanges = true;
    setTrackChangesEnabled(editor ?? this.getEditor(), true);
  }

  toggleTrackChanges() {
    const editor = this.getEditor();
    if (this.trackChanges && editor) {
      this.syncChangesPanelFromEditor(editor);
      void this.flushComments();
    }
    this.trackChanges = !this.trackChanges;
    setTrackChangesEnabled(editor, this.trackChanges);
    this.toast(this.trackChanges ? "Track changes on" : "Track changes off");
  }

  toggleShowEdits() {
    this.showEditsComments = !this.showEditsComments;
  }

  openReviewPanel() {
    this.showReviewPanel = true;
  }

  toggleReviewPanel() {
    this.showReviewPanel = !this.showReviewPanel;
  }

  setMode(mode: AppMode) {
    setTrackChangesEnabled(this.getEditor(), this.trackChanges);
    if (mode === "editor") {
      this.showReviewPanel = true;
    } else {
      this.showReviewPanel = false;
    }
  }

  cancelPendingComment() {
    const editor = this.getEditor();
    const markId = this.pendingCommentMarkId;
    if (editor && markId) {
      editor
        .chain()
        .focus()
        .command(({ tr, state, dispatch }) => {
          const { doc } = state;
          doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const mark of node.marks) {
              if (mark.type.name === "comment" && mark.attrs.markId === markId) {
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        })
        .run();
    }
    this.pendingCommentMarkId = "";
    this.pendingCommentAnchor = "";
  }

  addCommentOnSelection(selectionFrom?: number, selectionTo?: number) {
    const editor = this.getEditor();
    if (!editor) return;
    const sel = editor.state.selection;
    const from = selectionFrom ?? sel.from;
    const to = selectionTo ?? sel.to;
    if (from >= to) {
      this.toast("Select text to comment");
      return;
    }
    const docSize = editor.state.doc.content.size;
    if (from < 0 || to > docSize) {
      this.toast("Select text to comment");
      return;
    }
    const anchor = editor.state.doc.textBetween(from, to, " ", " ");
    const markId = crypto.randomUUID();
    const ok = editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .setMark("comment", { markId })
      .run();
    if (!ok) {
      this.toast("Could not add comment");
      return;
    }
    this.pendingCommentAnchor = anchor;
    this.pendingCommentMarkId = markId;
    requestAnimationFrame(() => {
      if (!editor.isDestroyed) this.syncCommentMarksFromEditor(editor);
    });
    return markId;
  }

  async loadChapterComments() {
    if (!libraryStore.library || !chapterStore.activeChapterId) return;
    this.chapterComments = await api.readChapterComments(
      libraryStore.library.path,
      chapterStore.activeChapterId,
      chapterStore.activeSection,
    );
    this.syncCommentMarksFromEditor();
  }

  scheduleSaveComments() {
    if (this.commentsTimer) clearTimeout(this.commentsTimer);
    this.commentsPendingSave = true;
    const gen = ++this.commentsSaveGen;
    this.commentsTimer = setTimeout(() => {
      this.commentsTimer = null;
      void this.saveChapterComments(gen);
    }, 800);
  }

  discardPendingCommentSave() {
    if (this.commentsTimer) {
      clearTimeout(this.commentsTimer);
      this.commentsTimer = null;
    }
    this.commentsPendingSave = false;
  }

  clearChapterCommentsState() {
    this.discardPendingCommentSave();
    this.chapterComments = { threads: [], changes: [] };
    this.commentMarkIdsInDoc = new Set();
    this.pendingCommentAnchor = "";
    this.pendingCommentMarkId = "";
  }

  /** Persist debounced comment sidecar changes. Returns false on failure. */
  async flushComments(): Promise<boolean> {
    if (this.commentsTimer) {
      clearTimeout(this.commentsTimer);
      this.commentsTimer = null;
    }
    while (this.commentsSaveInFlight) {
      await new Promise((r) => setTimeout(r, 0));
    }
    if (!this.commentsPendingSave) return true;
    if (!libraryStore.library || !chapterStore.activeChapterId) return true;
    if (
      !libraryStore.chapterExists(
        chapterStore.activeChapterId,
        chapterStore.activeSection,
      )
    ) {
      this.commentsPendingSave = false;
      return true;
    }
    return this.saveChapterComments(this.commentsSaveGen);
  }

  async saveChapterComments(forGen?: number): Promise<boolean> {
    const gen = forGen ?? this.commentsSaveGen;
    if (forGen !== undefined && gen !== this.commentsSaveGen) return true;

    if (!libraryStore.library || !chapterStore.activeChapterId) return true;
    if (
      !libraryStore.chapterExists(
        chapterStore.activeChapterId,
        chapterStore.activeSection,
      )
    ) {
      this.commentsPendingSave = false;
      return true;
    }
    const present = this.commentMarkIdsInDoc;
    const payload: ChapterComments = {
      ...this.chapterComments,
      threads: this.chapterComments.threads.filter((t) => present.has(t.markId)),
    };
    this.commentsSaveInFlight = true;
    try {
      await api.saveChapterComments(
        libraryStore.library.path,
        chapterStore.activeChapterId,
        payload,
        chapterStore.activeSection,
      );
      this.chapterComments = {
        ...payload,
        changes: this.chapterComments.changes,
      };
      if (gen === this.commentsSaveGen) {
        this.commentsPendingSave = false;
      }
      this.notifyReviewChange();
      return true;
    } catch (e) {
      this.toast(formatError(e));
      return false;
    } finally {
      this.commentsSaveInFlight = false;
    }
  }

  /** Live panel sync while typing; marks sidecar dirty when change metadata shifts. */
  syncChangesPanelFromEditor(editor?: Editor | null) {
    if (!this.trackChanges && this.pendingChanges.length === 0) return;
    const ed = editor ?? this.getEditor();
    if (!ed) return;
    const prev = this.chapterComments.changes;
    const changes = syncChangesFromEditor(ed, prev);
    if (!trackedChangesDiffer(prev, changes)) return;
    this.chapterComments = {
      ...this.chapterComments,
      changes,
    };
    this.commentsPendingSave = true;
  }

  onHtmlUpdated(html: string, opts?: { force?: boolean }) {
    if (
      !opts?.force &&
      !this.trackChanges &&
      this.pendingChanges.length === 0
    ) {
      return;
    }

    const editor = this.getEditor();
    const changes = editor
      ? syncChangesFromEditor(editor, this.chapterComments.changes)
      : syncChangesFromHtml(html, this.chapterComments.changes);

    this.chapterComments = {
      ...this.chapterComments,
      changes,
    };
    this.scheduleSaveComments();
  }

  async addComment(text: string, markId: string) {
    const thread: CommentThread = {
      id: crypto.randomUUID(),
      markId,
      anchorText: this.pendingCommentAnchor.slice(0, 120),
      resolved: false,
      replies: [
        {
          id: crypto.randomUUID(),
          text,
          author: this.getAuthorName(),
          createdAt: new Date().toISOString(),
        },
      ],
    };
    this.chapterComments = {
      ...this.chapterComments,
      threads: [...this.chapterComments.threads, thread],
    };
    const ok = await this.saveChapterComments();
    if (!ok) return;
    this.pendingCommentAnchor = "";
    this.pendingCommentMarkId = "";
  }

  async replyToThread(threadId: string, text: string) {
    this.chapterComments = {
      ...this.chapterComments,
      threads: this.chapterComments.threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              replies: [
                ...t.replies,
                {
                  id: crypto.randomUUID(),
                  text,
                  author: this.getReviewerName(),
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : t,
      ),
    };
    await this.saveChapterComments();
  }

  async resolveThread(threadId: string) {
    const thread = this.chapterComments.threads.find((t) => t.id === threadId);
    const editor = this.getEditor();
    if (editor && thread) {
      editor
        .chain()
        .command(({ tr, state, dispatch }) => {
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            for (const mark of node.marks) {
              if (
                mark.type.name === "comment" &&
                mark.attrs.markId === thread.markId
              ) {
                tr.removeMark(pos, pos + node.nodeSize, mark.type);
              }
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        })
        .run();
      const html = editor.getHTML();
      chapterStore.pendingHtml = html;
      chapterStore.activeChapterHtml = html;
      chapterStore.saveStatus = "unsaved";
      void chapterStore.flushSave();
    }
    this.chapterComments = {
      ...this.chapterComments,
      threads: this.chapterComments.threads.map((t) =>
        t.id === threadId ? { ...t, resolved: true } : t,
      ),
    };
    await this.saveChapterComments();
  }

  applyChange(change: TrackedChange, action: "accept" | "reject") {
    const editor = this.getEditor();
    if (!editor) return;

    const applied = applyChangeInEditor(editor, change, action);
    if (!applied) {
      this.toast("Could not apply change");
      return;
    }

    const html = editor.getHTML();
    chapterStore.pendingHtml = html;
    chapterStore.activeChapterHtml = html;
    chapterStore.saveStatus = "unsaved";

    this.chapterComments = {
      ...this.chapterComments,
      changes: this.chapterComments.changes.map((c) =>
        c.markId === change.markId
          ? { ...c, status: action === "accept" ? "accepted" : "rejected" }
          : c,
      ),
    };
    this.onHtmlUpdated(html, { force: true });
    void chapterStore.flushSave();
    this.notifyReviewChange();
  }

  private applyAllChanges(action: "accept" | "reject") {
    const pending = [...this.pendingChanges];
    if (pending.length === 0) return;

    const editor = this.getEditor();
    if (!editor) return;

    let failed = 0;
    for (const change of pending) {
      if (!applyChangeInEditor(editor, change, action)) failed++;
    }
    if (failed > 0) {
      this.toast(
        failed === pending.length
          ? "Could not apply changes"
          : `Could not apply ${failed} change${failed === 1 ? "" : "s"}`,
      );
    }

    const html = editor.getHTML();
    chapterStore.pendingHtml = html;
    chapterStore.activeChapterHtml = html;
    chapterStore.saveStatus = "unsaved";

    const resolved = action === "accept" ? "accepted" : "rejected";
    const pendingIds = new Set(pending.map((c) => c.markId));
    this.chapterComments = {
      ...this.chapterComments,
      changes: this.chapterComments.changes.map((c) =>
        pendingIds.has(c.markId) && c.status === "pending"
          ? { ...c, status: resolved }
          : c,
      ),
    };
    this.onHtmlUpdated(html, { force: true });
    void chapterStore.flushSave();
    this.notifyReviewChange();
  }

  acceptAllChanges() {
    this.applyAllChanges("accept");
  }

  rejectAllChanges() {
    this.applyAllChanges("reject");
  }

  scrollToComment(markId: string) {
    const editor = this.getEditor();
    if (!editor) {
      this.toast("Editor not ready");
      return;
    }
    if (!scrollToComment(editor, markId)) {
      this.toast("Could not find comment in text");
    }
  }

  scrollToChange(markId: string) {
    const editor = this.getEditor();
    if (!editor) {
      this.toast("Editor not ready");
      return;
    }
    if (!scrollToChange(editor, markId)) {
      this.toast("Could not find change in text");
    }
  }

  async tryLoadCommentsOnOpen(gen: number) {
    if (!chapterStore.isOpenGeneration(gen)) return false;
    if (!libraryStore.library || !chapterStore.activeChapterId) return false;

    this.clearChapterCommentsState();

    try {
      const comments = await api.readChapterComments(
        libraryStore.library.path,
        chapterStore.activeChapterId,
        chapterStore.activeSection,
      );
      if (!chapterStore.isOpenGeneration(gen)) return false;
      this.chapterComments = comments;
      const changes = syncChangesFromHtml(
        chapterStore.activeChapterHtml,
        comments.changes,
      );
      this.chapterComments = { ...this.chapterComments, changes };
      this.syncCommentMarksFromEditor();
      return true;
    } catch (e) {
      if (chapterStore.isOpenGeneration(gen)) {
        this.toast(formatError(e));
        this.chapterComments = { threads: [], changes: [] };
      }
      return false;
    }
  }
}

export const reviewStore = new ReviewStore();