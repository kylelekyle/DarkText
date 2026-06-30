<script lang="ts">
  import type { Editor } from "@tiptap/core";
  import { app } from "$lib/stores/app.svelte";
  import { fontStore } from "$lib/stores/fonts.svelte";
  import { setParagraphAlignment } from "$lib/editor/align";
  import {
    applyStickyFontSize,
    fontSizeMarkAtEditor,
  } from "$lib/editor/fontSize";
  import {
    FONT_SIZES,
    fontSizeLabel,
    fontSizePtCss,
    primaryFamily,
    resolveFontSize,
  } from "$lib/utils/typography";
  import FontFamilyPicker from "./FontFamilyPicker.svelte";


  interface Props {
    editor: Editor | null;
  }

  let { editor }: Props = $props();

  let canUndo = $state(false);
  let canRedo = $state(false);
  /** Font for new typing — stays until the user picks another in the toolbar. */
  let typingFont = $state(app.settings.defaultFontFamily);
  /** Size for new typing — stays until the user picks another in the toolbar. */
  let typingFontSize = $state(resolveFontSize(app.settings.defaultFontSize));
  let toolbarFontSize = $state(resolveFontSize(app.settings.defaultFontSize));
  let isBold = $state(false);
  let isItalic = $state(false);
  let isUnderline = $state(false);

  $effect(() => {
    typingFont = app.settings.defaultFontFamily;
    typingFontSize = resolveFontSize(app.settings.defaultFontSize);
  });

  function stickyFontIsActive(ed: Editor): boolean {
    const stored = ed.state.storedMarks;
    if (!stored?.length) return false;
    const textStyle = stored.find((m) => m.type.name === "textStyle");
    return textStyle?.attrs?.fontFamily === typingFont;
  }

  function applyStickyFont(ed: Editor) {
    if (!ed.state.selection.empty || stickyFontIsActive(ed)) return;
    ed.commands.setFontFamily(typingFont);
  }

  $effect(() => {
    if (!editor || editor.isDestroyed) {
      canUndo = false;
      canRedo = false;
      isBold = false;
      isItalic = false;
      isUnderline = false;
      return;
    }
    const syncToolbar = () => {
      if (editor.isDestroyed) return;
      canUndo = editor.can().undo();
      canRedo = editor.can().redo();
      isBold = editor.isActive("bold");
      isItalic = editor.isActive("italic");
      isUnderline = editor.isActive("underline");
      toolbarFontSize = fontSizeMarkAtEditor(editor) ?? typingFontSize;
    };
    const onSelectionUpdate = () => {
      syncToolbar();
      applyStickyFont(editor);
      applyStickyFontSize(editor, typingFontSize);
    };
    syncToolbar();
    applyStickyFont(editor);
    applyStickyFontSize(editor, typingFontSize);
    editor.on("transaction", syncToolbar);
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("transaction", syncToolbar);
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  });

  function cmd(fn: () => void) {
    return () => fn();
  }

  async function applyFont(cssValue: string) {
    if (!editor) return;
    const ok = await fontStore.ensureFont(cssValue);
    if (!ok) {
      app.showToast(`Font "${primaryFamily(cssValue)}" is not available on this system`);
      return;
    }

    typingFont = cssValue;
    editor.chain().focus().setFontFamily(cssValue).run();
  }

  function applyFontSize(val: string) {
    if (!editor) return;
    const size = resolveFontSize(val);
    typingFontSize = size;
    toolbarFontSize = size;
    editor.chain().focus().setFontSize(fontSizePtCss(size)).run();
  }

  function align(alignment: "left" | "center" | "right" | "justify") {
    if (!editor) return;
    setParagraphAlignment(editor, alignment);
  }
</script>

<div class="toolbar" class:editor-mode={app.mode === "editor"} class:author-mode={app.mode === "author"}>
  {#if app.mode === "author"}
    <FontFamilyPicker compact value={typingFont} onchange={(v) => void applyFont(v)} />

    <select
      class="tool-select narrow"
      value={toolbarFontSize}
      onchange={(e) => applyFontSize((e.currentTarget as HTMLSelectElement).value)}
    >
      {#each FONT_SIZES as size}
        <option value={size}>{fontSizeLabel(size)} pt</option>
      {/each}
    </select>

    <div class="sep"></div>

    <button
      class="tool-btn"
      class:active={isBold}
      title="Bold (Ctrl+B)"
      aria-pressed={isBold}
      onclick={cmd(() => editor?.chain().focus().toggleBold().run())}
    >
      <strong>B</strong>
    </button>
    <button
      class="tool-btn"
      class:active={isItalic}
      title="Italic (Ctrl+I)"
      aria-pressed={isItalic}
      onclick={cmd(() => editor?.chain().focus().toggleItalic().run())}
    >
      <em>I</em>
    </button>
    <button
      class="tool-btn"
      class:active={isUnderline}
      title="Underline (Ctrl+U)"
      aria-pressed={isUnderline}
      onclick={cmd(() => editor?.chain().focus().toggleUnderline().run())}
    >
      <span class="underline">U</span>
    </button>

    <div class="sep"></div>

    <button class="tool-btn" title="Heading 2" onclick={cmd(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}>H2</button>
    <button class="tool-btn" title="Heading 3" onclick={cmd(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())}>H3</button>

    <div class="sep"></div>

    <button class="tool-btn" title="Align left" onclick={cmd(() => align("left"))}>≡L</button>
    <button class="tool-btn" title="Align center" onclick={cmd(() => align("center"))}>≡C</button>
    <button class="tool-btn" title="Align right" onclick={cmd(() => align("right"))}>≡R</button>
    <button class="tool-btn" title="Justify" onclick={cmd(() => align("justify"))}>≣</button>

    <div class="sep"></div>

    <button class="tool-btn comment-btn" title="Add comment" onclick={cmd(() => app.addCommentOnSelection())}>Cmt</button>

    <div class="sep"></div>

    <button class="tool-btn" title="Undo" onclick={cmd(() => editor?.chain().focus().undo().run())} disabled={!canUndo}>↩</button>
    <button class="tool-btn" title="Redo" onclick={cmd(() => editor?.chain().focus().redo().run())} disabled={!canRedo}>↪</button>
  {:else}
    <span class="mode-label">Review Mode — track changes &amp; comments</span>
    <button class="tool-btn" title="Add comment" onclick={cmd(() => app.addCommentOnSelection())}>Comment</button>
    <div class="sep"></div>
    <button class="tool-btn" title="Undo" onclick={cmd(() => editor?.chain().focus().undo().run())} disabled={!canUndo}>↩</button>
    <button class="tool-btn" title="Redo" onclick={cmd(() => editor?.chain().focus().redo().run())} disabled={!canRedo}>↪</button>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-surface);
    min-height: 36px;
    flex-shrink: 0;
  }

  .toolbar.author-mode {
    flex-wrap: wrap;
  }

  .mode-label {
    font-size: 11px;
    color: var(--text-muted);
    margin-right: 8px;
  }

  .tool-select {
    font-size: 11px;
    padding: 3px 6px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    max-width: 110px;
  }

  .tool-select.narrow {
    max-width: 72px;
  }

  .sep {
    width: 1px;
    height: 18px;
    background: var(--border-subtle);
    margin: 0 4px;
  }

  .tool-btn {
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    color: var(--text-secondary);
    background: transparent;
    cursor: pointer;
    min-width: 28px;
  }

  .tool-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--border-subtle);
    color: var(--text-primary);
  }

  .tool-btn.active {
    background: var(--accent-subtle);
    border-color: var(--accent-dim);
    color: var(--accent-hover);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-dim) 35%, transparent);
  }

  .tool-btn.active:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-subtle) 80%, var(--bg-hover));
    border-color: var(--accent-dim);
    color: var(--accent-hover);
  }

  .tool-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .underline {
    text-decoration: underline;
  }

  .comment-btn {
    font-size: 10px;
    letter-spacing: 0.02em;
  }
</style>