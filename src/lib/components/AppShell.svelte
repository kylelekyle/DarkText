<script lang="ts">
  import { onMount } from "svelte";
  import type { Editor } from "@tiptap/core";
  import { app } from "$lib/stores/app.svelte";
  import Sidebar from "./Sidebar.svelte";
  import MenuBar from "./MenuBar.svelte";
  import Toolbar from "./Toolbar.svelte";
  import ChapterEditor from "./ChapterEditor.svelte";
  import StatusBar from "./StatusBar.svelte";
  import QuickActions from "./QuickActions.svelte";
  import BookSettingsDialog from "./dialogs/BookSettingsDialog.svelte";
  import SettingsDialog from "./dialogs/SettingsDialog.svelte";
  import ShortcutsDialog from "./dialogs/ShortcutsDialog.svelte";
  import CompileDialog from "./dialogs/CompileDialog.svelte";
  import FindReplaceDialog from "./dialogs/FindReplaceDialog.svelte";
  import GlobalSearchDialog from "./dialogs/GlobalSearchDialog.svelte";
  import ExportChapterDialog from "./dialogs/ExportChapterDialog.svelte";
  import RenameChapterDialog from "./dialogs/RenameChapterDialog.svelte";
  import AddCommentDialog from "./dialogs/AddCommentDialog.svelte";
  import MindMapPanel from "./MindMapPanel.svelte";
  import ReadThroughPanel from "./ReadThroughPanel.svelte";
  import ReviewPanel from "./ReviewPanel.svelte";
  import LibraryReviewDialog from "./dialogs/LibraryReviewDialog.svelte";
  import EditorHandoffDialog from "./dialogs/EditorHandoffDialog.svelte";
  import ChapterSnapshotsDialog from "./dialogs/ChapterSnapshotsDialog.svelte";
  import ConfirmDialog from "./dialogs/ConfirmDialog.svelte";
  import { handleGlobalShortcut } from "$lib/shortcuts/registry";
  import { reviewStore } from "$lib/stores/review.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import type { ChapterSection } from "$lib/types";
  import { clearSidebarSelectionOnOutsideClick } from "$lib/utils/sidebarSelectionClear";

  onMount(() => {
    if (app.confirmDialog) app.resolveConfirm(false);
    app.showQuickActions = false;
    for (const el of document.querySelectorAll("body > .overlay")) {
      el.remove();
    }
    for (const el of document.querySelectorAll("dialog")) {
      try {
        if ((el as HTMLDialogElement).open) (el as HTMLDialogElement).close();
      } catch {
        /* ignore */
      }
      el.remove();
    }
  });

  function handleUpdate(ed: Editor) {
    reviewStore.syncCommentMarksFromEditor(ed);
    reviewStore.syncChangesPanelFromEditor(ed);
    app.scheduleAutoSave(ed);
  }

  function emptyStateAction(): { label: string; run: () => void } {
    const chapters = libraryStore.library?.chapters.length ?? 0;
    if (chapters === 0 && libraryStore.researchChapters.length > 0) {
      const id = libraryStore.researchChapters[0].id;
      return {
        label: "Open first Research note",
        run: () => void app.openChapter(id, "research"),
      };
    }
    if (chapters === 0 && libraryStore.characterChapters.length > 0) {
      const id = libraryStore.characterChapters[0].id;
      return {
        label: "Open first Character sheet",
        run: () => void app.openChapter(id, "characters"),
      };
    }
    const section: ChapterSection = app.sidebarTab === "research"
      ? "research"
      : app.sidebarTab === "characters"
        ? "characters"
        : "chapters";
    const label =
      section === "research"
        ? "Create Research note"
        : section === "characters"
          ? "Create Character sheet"
          : "Create your first Chapter";
    return { label, run: () => void app.newChapter(undefined, section) };
  }

  const emptyCta = $derived(emptyStateAction());

  function onKeydown(e: KeyboardEvent) {
    if (handleGlobalShortcut(e, { editor: app.editorRef })) return;

    if (e.key === "Escape") {
      if (app.confirmDialog) return;
      if (app.showReadThrough) app.showReadThrough = false;
      else if (app.showMindMap) app.showMindMap = false;
      else if (app.showQuickActions) app.showQuickActions = false;
      else if (app.activeDialog) app.closeDialog();
      else if (app.focusMode) app.toggleFocusMode();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} onclick={clearSidebarSelectionOnOutsideClick} />

<div
  class="app-shell"
  class:mode-author={app.mode === "author"}
  class:mode-editor={app.mode === "editor"}
  class:focus-mode={app.focusMode}
  class:show-edits={app.showEditsComments}
>
  <MenuBar editor={app.editorRef} />

  <div class="toolbar-slot" class:hidden={app.focusMode}>
    <Toolbar editor={app.editorRef} />
  </div>

  <div class="workspace">
    <div
      class="sidebar-slot"
      class:hidden={app.focusMode}
      style="--slot-width: {app.sidebarCollapsed ? 40 : app.sidebarWidth}px"
    >
      <Sidebar />
    </div>

    <main class="editor-area">
      {#if app.activeChapterId}
        <ChapterEditor
          html={app.activeChapterHtml}
          chapterId={app.activeChapterId}
          editorRevision={app.editorRevision}
          spellcheck={app.spellcheck}
          onUpdate={handleUpdate}
          onEditorReady={(ed) => app.setEditor(ed)}
        />
      {:else}
        <div class="empty-state">
          <p>No item selected</p>
          <button class="btn" onclick={emptyCta.run}>{emptyCta.label}</button>
        </div>
      {/if}
    </main>

    {#if app.mode === "editor" && app.showReviewPanel && !app.focusMode}
      <aside class="review-slot">
        <div class="review-header">
          <span class="review-title">Review</span>
          <button
            class="review-close"
            title="Close review panel"
            onclick={() => app.toggleReviewPanel()}
          >
            ×
          </button>
        </div>
        <div class="review-body">
          <ReviewPanel />
        </div>
      </aside>
    {/if}
  </div>

  <StatusBar />

  {#if app.toast}
    <div class="toast">{app.toast}</div>
  {/if}

  {#if app.focusMode}
    <button
      type="button"
      class="focus-exit-btn"
      onclick={() => app.toggleFocusMode()}
    >
      Exit Focus Mode (or press Esc)
    </button>
  {/if}
</div>

<QuickActions editor={app.editorRef} />

{#if app.showMindMap}
  <MindMapPanel />
{/if}

{#if app.showReadThrough}
  <ReadThroughPanel />
{/if}

{#if app.activeDialog === "bookSettings"}
  <BookSettingsDialog />
{:else if app.activeDialog === "settings"}
  <SettingsDialog />
{:else if app.activeDialog === "shortcuts"}
  <ShortcutsDialog />
{:else if app.activeDialog === "compile"}
  <CompileDialog />
{:else if app.activeDialog === "findReplace"}
  <FindReplaceDialog editor={app.editorRef} />
{:else if app.activeDialog === "globalSearch"}
  <GlobalSearchDialog />
{:else if app.activeDialog === "libraryReview"}
  <LibraryReviewDialog />
{:else if app.activeDialog === "editorHandoff"}
  <EditorHandoffDialog />
{:else if app.activeDialog === "exportChapter"}
  <ExportChapterDialog />
{:else if app.activeDialog === "renameChapter"}
  <RenameChapterDialog />
{:else if app.activeDialog === "addComment"}
  <AddCommentDialog />
{:else if app.activeDialog === "chapterSnapshots"}
  <ChapterSnapshotsDialog />
{/if}

<ConfirmDialog />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    transition: background var(--transition-smooth);
  }

  .toolbar-slot {
    flex-shrink: 0;
    overflow: hidden;
    max-height: 48px;
    opacity: 1;
    transition: max-height var(--transition-focus), opacity var(--transition-smooth);
  }

  .toolbar-slot.hidden {
    max-height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .workspace {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .sidebar-slot {
    flex-shrink: 0;
    overflow: hidden;
    width: var(--slot-width);
    height: 100%;
    opacity: 1;
    transition: width var(--transition-focus), opacity var(--transition-smooth);
  }

  .sidebar-slot :global(.sidebar) {
    height: 100%;
  }

  .sidebar-slot.hidden {
    width: 0 !important;
    opacity: 0;
    pointer-events: none;
  }

  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background: var(--editor-canvas);
    transition: background var(--transition-focus);
  }

  .review-slot {
    flex-shrink: 0;
    width: 280px;
    display: flex;
    flex-direction: column;
    background: var(--bg-surface);
    border-left: 1px solid var(--border-subtle);
    overflow: hidden;
    animation: review-in 0.22s var(--ease-focus);
  }

  @keyframes review-in {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .review-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .review-close {
    font-size: 16px;
    line-height: 1;
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .review-close:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .review-body {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .app-shell.mode-editor .editor-area {
    background: var(--editor-canvas);
  }

  .app-shell.focus-mode .editor-area {
    background: radial-gradient(
      ellipse 130% 90% at 50% 20%,
      #0b0b0b 0%,
      var(--editor-canvas) 55%,
      var(--bg-deep) 100%
    );
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--text-muted);
    animation: fade-in 0.4s ease;
  }

  .empty-state p {
    font-size: 14px;
    letter-spacing: 0.01em;
  }

  .empty-state .btn {
    padding: 10px 20px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-secondary);
    background: var(--bg-surface);
    font-weight: 500;
  }

  .empty-state .btn:hover {
    color: var(--text-primary);
    border-color: var(--accent-dim);
    background: var(--accent-subtle);
  }

  .toast {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    padding: 10px 18px;
    border-radius: var(--radius);
    font-size: 12px;
    color: var(--text-secondary);
    z-index: 200;
    box-shadow: var(--shadow-md);
    animation: fade-in-up 0.35s var(--ease-focus);
  }

  .focus-exit-btn {
    position: fixed;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 150;
    padding: 8px 18px;
    font-size: 11px;
    letter-spacing: 0.02em;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    opacity: 0.45;
    box-shadow: var(--shadow-sm);
    transition: opacity var(--transition-smooth), background var(--transition-fast),
      border-color var(--transition-fast), color var(--transition-fast),
      transform var(--transition-fast);
    animation: focus-exit-in 0.5s var(--ease-focus) 0.35s both;
  }

  .focus-exit-btn:hover {
    opacity: 1;
    color: var(--text-primary);
    border-color: var(--border);
    background: var(--bg-surface);
    transform: translateX(-50%) translateY(-1px);
  }

  @keyframes focus-exit-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(8px);
    }
    to {
      opacity: 0.45;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>