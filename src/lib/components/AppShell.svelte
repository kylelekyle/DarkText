<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { Editor } from "@tiptap/core";
  import { app } from "$lib/stores/app.svelte";
  import Sidebar from "./Sidebar.svelte";
  import MenuBar from "./MenuBar.svelte";
  import Toolbar from "./Toolbar.svelte";
  import ChapterEditor from "./ChapterEditor.svelte";
  import SplitPaneChrome from "./SplitPaneChrome.svelte";
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
  import GraphPanel from "./GraphPanel.svelte";
  import ReadThroughPanel from "./ReadThroughPanel.svelte";

  import LibraryReviewDialog from "./dialogs/LibraryReviewDialog.svelte";
  import EditorHandoffDialog from "./dialogs/EditorHandoffDialog.svelte";
  import ChapterSnapshotsDialog from "./dialogs/ChapterSnapshotsDialog.svelte";
  import ConfirmDialog from "./dialogs/ConfirmDialog.svelte";
  import ReviewPanel from "./ReviewPanel.svelte";
  import ReviewColorStyles from "./ReviewColorStyles.svelte";
  import ReviewHoverCard from "./ReviewHoverCard.svelte";
  import { handleGlobalShortcut } from "$lib/shortcuts/registry";
  import { playTypingSound } from "$lib/utils/typingSounds";
  import { portal } from "$lib/utils/platform";
  import { reviewStore } from "$lib/stores/review.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import type { ChapterSection } from "$lib/types";
  import { clearSidebarSelectionOnOutsideClick } from "$lib/utils/sidebarSelection";

  onMount(() => {
    void tick().then(() => app.syncReviewPanelDom());
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

  function handlePrimaryUpdate(ed: Editor) {
    reviewStore.syncCommentMarksFromEditor(ed);
    reviewStore.syncChangesPanelFromEditor(ed);
    app.scheduleAutoSave(ed);
  }

  function handleSplitUpdate(ed: Editor) {
    app.scheduleSplitAutoSave(ed);
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

  let splitEl = $state<HTMLDivElement | null>(null);
  let isSplitResizing = $state(false);
  let splitResizeCleanup: (() => void) | null = null;

  function stopSplitResize() {
    splitResizeCleanup?.();
    splitResizeCleanup = null;
    isSplitResizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    app.commitSplitRatio();
  }

  onDestroy(() => stopSplitResize());

  function resetSplitRatio() {
    app.setSplitRatio(0.5);
    app.commitSplitRatio();
  }

  function startSplitResize(e: PointerEvent) {
    if (!splitEl || e.button !== 0) return;
    e.preventDefault();
    stopSplitResize();
    isSplitResizing = true;
    const rect = splitEl.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      const ratio = (ev.clientX - rect.left) / rect.width;
      app.setSplitRatio(ratio);
    };

    const onUp = () => stopSplitResize();

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    splitResizeCleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }

  function exitSplitView() {
    void app.toggleSplitView();
  }

  function onKeydown(e: KeyboardEvent) {
    playTypingSound(app.settings.typingSound, e);
    if (handleGlobalShortcut(e, { editor: app.activeEditorRef })) return;

    if (e.key === "Escape") {
      if (app.confirmDialog) return;
      if (app.showReadThrough) app.showReadThrough = false;
      else if (app.showMindMap) app.showMindMap = false;
      else if (app.showQuickActions) app.showQuickActions = false;
      else if (app.activeDialog) app.closeDialog();
      else if (app.splitViewEnabled && !app.focusMode) {
        if (document.querySelector(".chapter-picker")) return;
        exitSplitView();
      } else if (app.focusMode) app.toggleFocusMode();
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
  class:review-panel-open={app.mode === "editor" &&
    !app.focusMode &&
    !app.reviewPanelDismissed}
>
  <MenuBar editor={app.activeEditorRef} />

  <div class="toolbar-slot" class:hidden={app.focusMode}>
    <Toolbar editor={app.activeEditorRef} />
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
      <div
        class="editor-split"
        class:active={app.splitViewEnabled && !app.focusMode}
        class:resizing={isSplitResizing}
        bind:this={splitEl}
        style={app.splitViewEnabled && !app.focusMode
          ? `--split-primary-pct: ${app.splitRatio * 100}%`
          : undefined}
      >
        <div
          class="editor-pane primary"
          class:focused={!app.splitViewEnabled || app.focusedPane === "primary"}
          class:with-chrome={app.splitViewEnabled && !app.focusMode}
          role="group"
          aria-label="Primary editor"
        >
          {#if app.splitViewEnabled && !app.focusMode}
            <SplitPaneChrome
              focused={app.focusedPane === "primary"}
              title={app.activeChapterMeta?.title ?? "No chapter"}
              chapterId={app.activeChapterId}
              section={app.activeSection}
              onFocus={() => app.focusPane("primary")}
            />
          {/if}
          {#if app.activeChapterId}
            <ChapterEditor
              pane="primary"
              html={app.activeChapterHtml}
              chapterId={app.activeChapterId}
              editorRevision={app.editorRevision}
              spellcheck={app.spellcheck}
              onUpdate={handlePrimaryUpdate}
              onEditorReady={(ed) => app.setEditor(ed)}
            />
          {:else}
            <div class="empty-state">
              <p>No item selected</p>
              <button class="btn" onclick={emptyCta.run}>{emptyCta.label}</button>
            </div>
          {/if}
        </div>

        {#if app.splitViewEnabled && !app.focusMode}
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <div
            class="editor-splitter"
            class:dragging={isSplitResizing}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize split panes"
            title="Drag to resize · Double-click to center"
            aria-valuenow={Math.round(app.splitRatio * 100)}
            aria-valuemin={22}
            aria-valuemax={78}
            onpointerdown={startSplitResize}
            ondblclick={resetSplitRatio}
          ></div>
          <div
            class="editor-pane secondary"
            class:focused={app.focusedPane === "secondary"}
            class:with-chrome={true}
            role="group"
            aria-label="Secondary editor"
          >
            <SplitPaneChrome
              focused={app.focusedPane === "secondary"}
              title={app.splitChapterMeta?.title ?? ""}
              chapterId={app.splitChapterId}
              section={app.splitSection}
              showPicker
              onFocus={() => app.focusPane("secondary")}
              onPick={(id, sec) => void app.openChapterInSplit(id, sec)}
            />
            {#if app.splitChapterId}
              <ChapterEditor
                pane="secondary"
                html={app.splitChapterHtml}
                chapterId={app.splitChapterId}
                editorRevision={app.splitEditorRevision}
                spellcheck={app.spellcheck}
                onUpdate={handleSplitUpdate}
                onEditorReady={(ed) => app.setSplitEditor(ed)}
              />
            {:else}
              <div
                class="empty-state"
                role="button"
                tabindex="0"
                onclick={() => app.focusPane("secondary")}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") app.focusPane("secondary");
                }}
              >
                <p>Select a chapter for the right pane</p>
                <p class="empty-hint">
                  Alt+click or middle-click a chapter in the sidebar, or right-click → Open in Split View
                </p>
              </div>
            {/if}
          </div>
          <button
            type="button"
            class="split-exit-btn"
            title="Exit split view (Esc)"
            onclick={exitSplitView}
          >
            Exit split <kbd class="split-exit-key">Esc</kbd>
          </button>
        {/if}
      </div>
    </main>

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

<aside
  class="review-slot"
  class:is-open={app.mode === "editor" && !app.focusMode && !app.reviewPanelDismissed}
  aria-label="Review panel"
  aria-hidden={!(app.mode === "editor" && !app.focusMode && !app.reviewPanelDismissed)}
  use:portal
>
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

<QuickActions editor={app.activeEditorRef} />

{#if app.showMindMap}
  <GraphPanel />
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
  <FindReplaceDialog editor={app.activeEditorRef} />
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

<ReviewColorStyles />
<ReviewHoverCard />

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    transition: background var(--transition-smooth);
  }

  .app-shell.review-panel-open :global(.editor-area) {
    margin-right: 280px;
    transition: margin-right var(--transition-smooth);
  }

  :global(aside.review-slot) {
    position: fixed;
    top: calc(var(--titlebar-height) + 36px + 36px);
    right: 0;
    bottom: 28px;
    width: 280px;
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border-left: 2px solid var(--accent);
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    z-index: 180;
    pointer-events: none;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.18s ease, visibility 0.18s ease;
  }

  :global(aside.review-slot.is-open) {
    visibility: visible;
    opacity: 1;
    pointer-events: auto;
  }

  :global(aside.review-slot .review-header) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  :global(aside.review-slot .review-title) {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  :global(aside.review-slot .review-close) {
    font-size: 16px;
    line-height: 1;
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
  }

  :global(aside.review-slot .review-close:hover) {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  :global(aside.review-slot .review-body) {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
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
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--editor-canvas);
    transition: background var(--transition-focus), margin-right var(--transition-smooth);
  }

  .editor-split {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .editor-split.active {
    position: relative;
    flex-direction: row;
  }

  .editor-split.active .editor-pane.primary {
    flex: 0 0 var(--split-primary-pct, 50%);
    min-width: 180px;
    max-width: calc(100% - 196px);
  }

  .editor-split.active .editor-pane.secondary {
    flex: 1 1 auto;
    min-width: 180px;
  }

  .editor-split.resizing .editor-pane {
    transition: none;
    pointer-events: none;
  }

  .editor-split.resizing .editor-splitter {
    pointer-events: auto;
  }

  .split-exit-btn {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    border: 1px solid color-mix(in srgb, var(--border-subtle) 70%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
    backdrop-filter: blur(10px);
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.16);
    opacity: 0.42;
    cursor: pointer;
    pointer-events: auto;
    transition: opacity var(--transition-smooth), border-color var(--transition-fast),
      color var(--transition-fast), background var(--transition-fast),
      box-shadow var(--transition-fast), transform var(--transition-fast);
    animation: split-exit-in 0.45s var(--ease-focus) 0.2s both;
  }

  .split-exit-btn:hover {
    opacity: 1;
    color: var(--text-primary);
    border-color: var(--border);
    background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
    box-shadow: var(--shadow-md);
    transform: translateX(-50%) translateY(-1px);
  }

  .split-exit-key {
    display: inline-flex;
    align-items: center;
    padding: 1px 5px;
    border: 1px solid color-mix(in srgb, var(--border-subtle) 80%, transparent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--bg-surface) 70%, transparent);
    color: var(--text-muted);
    font-family: inherit;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    line-height: 1.3;
  }

  .split-exit-btn:hover .split-exit-key {
    color: var(--text-secondary);
    border-color: var(--border-subtle);
  }

  @keyframes split-exit-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(8px);
    }
    to {
      opacity: 0.42;
      transform: translateX(-50%) translateY(0);
    }
  }

  .editor-pane {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    transition: flex-basis var(--transition-smooth);
  }

  .editor-pane.with-chrome :global(.editor-scroller) {
    padding-top: 44px;
  }

  .editor-splitter {
    position: relative;
    flex-shrink: 0;
    width: 1px;
    align-self: stretch;
    background: var(--border-subtle);
    cursor: col-resize;
    z-index: 6;
    touch-action: none;
    transition: background var(--transition-fast);
  }

  .editor-splitter::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: -5px;
    width: 11px;
  }

  .editor-splitter:hover,
  .editor-splitter.dragging {
    background: var(--accent-dim);
  }

  .editor-split.resizing .editor-splitter {
    background: var(--accent-dim);
  }

  .empty-hint {
    font-size: 12px;
    max-width: 280px;
    text-align: center;
    line-height: 1.5;
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