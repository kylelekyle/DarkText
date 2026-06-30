<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { deferHeavyWork } from "$lib/utils/platform";
  import { Editor } from "@tiptap/core";
  import {
    buildChapterEditorProps,
    buildChapterExtensions,
    type SpellContextMenuState,
  } from "$lib/editor/chapterEditorSetup";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { reviewStore } from "$lib/stores/review.svelte";
  import { focusEditorAtEnd } from "$lib/editor/focus";
  import { prewarmSpellcheck } from "$lib/utils/spellcheck";
  import { app } from "$lib/stores/app.svelte";
  import type { EditorPane } from "$lib/stores/chapter.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import CommentBalloons from "./CommentBalloons.svelte";


  interface Props {
    html: string;
    chapterId: string | null;
    editorRevision?: number;
    spellcheck?: boolean;
    pane?: EditorPane;
    onUpdate?: (editor: Editor) => void;
    onEditorReady?: (editor: Editor | null) => void;
  }

  let {
    html,
    chapterId,
    editorRevision = 0,
    spellcheck = true,
    pane = "primary",
    onUpdate,
    onEditorReady,
  }: Props = $props();

  // Assigned via bind:this below; the linter can't see that Svelte binding as an assignment.
  // oxlint-disable-next-line no-unassigned-vars
  let element: HTMLDivElement;
  let scrollerEl = $state<HTMLElement | null>(null);
  let editor = $state<Editor | null>(null);
  let mountedChapterId = $state<string | null>(null);
  let mountedRevision = $state(-1);
  let contextMenu = $state<SpellContextMenuState | null>(null);
  let contextMenuGen = 0;
  let contextCanUndo = $state(false);
  let contextCanRedo = $state(false);
  let onTransactionHandler: (() => void) | null = null;

  // Comment balloons live in the primary pane (review store tracks that editor).
  const balloonsActive = $derived(
    pane === "primary" &&
      app.mode === "editor" &&
      !app.focusMode &&
      (app.effectiveMarkupMode === "all" ||
        app.effectiveMarkupMode === "simple") &&
      reviewStore.activeThreads.length > 0,
  );

  const contextHandlers = {
    nextGen: () => ++contextMenuGen,
    isCurrentGen: (gen: number) => gen === contextMenuGen,
    setContextMenu: (menu: SpellContextMenuState | null) => {
      contextMenu = menu;
    },
    notifyBlockedImagePaste: () => app.showToast("Please use Insert Image"),
  };

  function onMountPaddingMousedown(e: MouseEvent) {
    if (!editor || e.button !== 0) return;
    if (e.target === element) {
      e.preventDefault();
      focusEditorAtEnd(editor);
    }
  }

  onMount(() => {
    let ed!: Editor;
    ed = new Editor({
      element,
      extensions: buildChapterExtensions(libraryStore.library?.path ?? null),
      content: html,
      autofocus: pane === "primary",
      editorProps: buildChapterEditorProps(() => ed, spellcheck, contextHandlers),
      onUpdate: ({ editor: updated }) => {
        onUpdate?.(updated);
      },
    });

    element.addEventListener("mousedown", onMountPaddingMousedown);
    onTransactionHandler = () => {
      if (ed.isDestroyed) return;
      contextCanUndo = ed.can().undo();
      contextCanRedo = ed.can().redo();
      if (pane === "primary") reviewStore.syncCommentMarksFromEditor(ed);
    };
    ed.on("transaction", onTransactionHandler);
    editor = ed;
    if (spellcheck) deferHeavyWork(() => prewarmSpellcheck());
    onEditorReady?.(ed);
    mountedChapterId = chapterId;
    mountedRevision = editorRevision;
  });

  $effect(() => {
    if (!editor) return;
    const libraryPath = libraryStore.library?.path ?? null;
    const imageExt = editor.extensionManager.extensions.find((e) => e.name === "image");
    if (imageExt?.options) {
      imageExt.options.libraryPath = libraryPath;
    }
  });

  $effect(() => {
    if (!editor || editor.isDestroyed) return;
    const chapterChanged = chapterId !== mountedChapterId;
    const revisionChanged = editorRevision !== mountedRevision;
    if (!chapterChanged && !revisionChanged) return;

    editor.commands.setContent(html, { emitUpdate: false });
    mountedChapterId = chapterId;
    mountedRevision = editorRevision;
    if (pane === "primary") {
      reviewStore.attachEditor(editor);
    }
    // Only jump to end when switching chapters — not after accept/reject revision bumps.
    if (chapterChanged && chapterId && pane === "primary") {
      const ed = editor;
      requestAnimationFrame(() => {
        if (!ed.isDestroyed && chapterId === mountedChapterId) {
          ed.commands.focus("end");
        }
      });
    }
  });

  $effect(() => {
    if (!editor) return;
    const built = buildChapterEditorProps(() => editor!, spellcheck, contextHandlers);
    const prev = editor.options.editorProps ?? {};
    editor.setOptions({
      editorProps: {
        ...prev,
        ...built,
        handleDOMEvents: {
          ...prev.handleDOMEvents,
          ...built.handleDOMEvents,
        },
      },
    });
  });

  onDestroy(() => {
    element?.removeEventListener("mousedown", onMountPaddingMousedown);
    const ed = editor;
    editor = null;
    onEditorReady?.(null);
    if (ed && !ed.isDestroyed) {
      if (onTransactionHandler) ed.off("transaction", onTransactionHandler);
      deferHeavyWork(() => {
        if (!ed.isDestroyed) ed.destroy();
      });
    }
  });

  function closeContextMenu() {
    contextMenu = null;
  }
</script>

<svelte:window onclick={closeContextMenu} />

<div class="chapter-editor" data-editor-pane={pane} role="group">
  <div
    class="editor-scroller"
    class:focus-mode={app.focusMode}
    class:has-balloons={balloonsActive}
    bind:this={scrollerEl}
  >
    <div
      class="editor-page"
      role="presentation"
      onmousedown={(e) => {
        if (app.splitViewEnabled) app.focusPane(pane);
        if (!editor || e.button !== 0) return;
        const prose = element?.querySelector(".ProseMirror");
        if (prose && !prose.contains(e.target as Node)) {
          e.preventDefault();
          focusEditorAtEnd(editor);
        }
      }}
    >
      <div
        class="editor-mount"
        class:editor-mode={app.mode === "editor"}
        class:markup-all={app.effectiveMarkupMode === "all"}
        class:markup-simple={app.effectiveMarkupMode === "simple"}
        class:markup-none={app.effectiveMarkupMode === "none"}
        class:markup-original={app.effectiveMarkupMode === "original"}
        class:track-on={reviewStore.trackChanges}
        bind:this={element}
      ></div>
    </div>
    {#if pane === "primary"}
      <CommentBalloons scroller={scrollerEl} revision={editorRevision} />
    {/if}
  </div>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    {editor}
    canUndo={contextCanUndo}
    canRedo={contextCanRedo}
    spellWord={contextMenu.spellWord}
    spellFrom={contextMenu.spellFrom}
    spellTo={contextMenu.spellTo}
    spellSuggestions={contextMenu.spellSuggestions}
    onAddComment={() => {
      app.addCommentOnSelection(
        contextMenu?.selectionFrom,
        contextMenu?.selectionTo,
      );
      closeContextMenu();
    }}
    onClose={closeContextMenu}
  />
{/if}

<style>
  .chapter-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .editor-scroller {
    position: relative;
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px 72px;
    transition: padding var(--transition-focus);
  }

  /* Reserve a right gutter for comment balloons (Word-style margin). */
  .editor-scroller.has-balloons {
    padding-right: 280px;
  }

  .editor-scroller.focus-mode {
    padding: 40px 48px 80px;
  }

  .editor-page {
    max-width: 720px;
    margin: 0 auto;
    background: var(--bg-page);
    border: 1px solid var(--border-page);
    border-radius: 2px;
    box-shadow: var(--shadow-page);
    min-height: calc(100% - 16px);
    transition: transform var(--transition-focus), box-shadow var(--transition-focus),
      border-color var(--transition-smooth);
    transform-origin: center top;
    cursor: text;
  }

  .editor-scroller.focus-mode .editor-page {
    transform: scale(1.014);
    box-shadow: var(--shadow-page-focus);
    border-color: rgba(201, 165, 92, 0.08);
  }

  .editor-mount {
    padding: 60px 68px 108px;
    cursor: text;
    min-height: 480px;
  }

  .editor-mount :global(.chapter-prose) {
    max-width: 100%;
    margin: 0;
    min-height: 100%;
    outline: none;
    font-family: var(--font-editor);
    font-size: var(--editor-font-size, 12pt);
    line-height: 1.82;
    color: var(--text-primary);
    caret-color: var(--accent);
    letter-spacing: 0.012em;
  }

  .editor-mount :global(.chapter-prose p) {
    margin: 0 0 0.65em;
  }

  .editor-mount :global(.chapter-prose p:last-child) {
    min-height: 1.82em;
  }

  .editor-mount :global(.chapter-prose img) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0.75em auto;
  }

  .editor-mount :global(.chapter-prose table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75em 0;
    font-size: 0.95em;
  }

  .editor-mount :global(.chapter-prose th),
  .editor-mount :global(.chapter-prose td) {
    border: 1px solid var(--border);
    padding: 6px 8px;
    vertical-align: top;
  }

  .editor-mount :global(.chapter-prose th) {
    background: var(--bg-elevated);
    font-weight: 600;
  }

  .editor-mount :global(.chapter-prose h2) {
    font-size: 1.35em;
    font-weight: 600;
    margin: 1.2em 0 0.5em;
    color: var(--text-primary);
  }

  .editor-mount :global(.chapter-prose h3) {
    font-size: 1.12em;
    font-weight: 600;
    margin: 1em 0 0.4em;
    color: var(--text-secondary);
  }

  .editor-mount :global(.dt-jump-flash) {
    animation: jump-flash 1.2s ease;
  }

  @keyframes jump-flash {
    0%,
    15% {
      background: rgba(201, 165, 92, 0.35);
      box-shadow: 0 0 0 2px rgba(201, 165, 92, 0.25);
    }
    100% {
      background: transparent;
      box-shadow: none;
    }
  }

  .editor-mount :global(.chapter-prose ::-webkit-spelling-error) {
    text-decoration-color: #ff7a45;
    text-decoration-line: underline;
    text-decoration-style: wavy;
  }

  .editor-mount :global(.chapter-prose ::-moz-spelling-error) {
    text-decoration-color: #ff7a45;
    text-decoration-line: underline;
    text-decoration-style: wavy;
  }

  /* ---- Review markup display modes (Word-style) ---- */
  /* Comments: highlighted only when markup shows them (All / Simple). */
  .editor-mount :global(.dt-comment) {
    background: transparent;
    border-bottom: none;
  }

  .editor-mount.markup-all :global(.dt-comment),
  .editor-mount.markup-simple :global(.dt-comment) {
    background: rgba(201, 162, 39, 0.16);
    border-bottom: 1px dashed var(--status-refine);
    padding: 0 2px;
    border-radius: 2px;
  }

  /* Stronger highlight when the matching margin balloon is hovered. */
  .editor-mount :global(.dt-comment.dt-comment-active) {
    background: rgba(201, 162, 39, 0.34);
    box-shadow: 0 0 0 1px var(--status-refine);
  }

  /* Insertions: plain by default; colored per-author underline in All markup. */
  .editor-mount :global(.dt-insertion) {
    background: transparent;
  }

  .editor-mount.markup-all :global(.dt-insertion) {
    background: color-mix(in srgb, var(--rev-color, var(--status-final)) 18%, transparent);
    border-bottom: 1px solid var(--rev-color, var(--status-final));
    color: var(--rev-color, inherit);
  }

  /* Original view = "before all edits": inserted text is hidden. */
  .editor-mount.markup-original :global(.dt-insertion) {
    display: none;
  }

  /* Deletions: plain by default (shown as the original text in Original view). */
  .editor-mount :global(.dt-deletion) {
    background: transparent;
    text-decoration: none;
  }

  .editor-mount.markup-all :global(.dt-deletion) {
    background: color-mix(in srgb, var(--rev-color, var(--danger)) 14%, transparent);
    text-decoration: line-through;
    color: var(--rev-color, var(--danger));
  }

  /* Final view (Simple / No Markup) = "after all edits": deletions hidden. */
  .editor-mount.markup-simple :global(.dt-deletion),
  .editor-mount.markup-none :global(.dt-deletion) {
    display: none;
  }

  /* Left-margin revision bar for blocks containing changes (All / Simple). */
  .editor-mount :global(.dt-change-block) {
    position: relative;
  }

  .editor-mount.markup-all :global(.dt-change-block)::before,
  .editor-mount.markup-simple :global(.dt-change-block)::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: -14px;
    width: 2px;
    border-radius: 1px;
    background: var(--rev-bar, var(--accent));
  }
</style>