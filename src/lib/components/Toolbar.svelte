<script lang="ts">
  import type { Editor } from "@tiptap/core";
  import { app } from "$lib/stores/app.svelte";
  import { fontStore } from "$lib/stores/fonts.svelte";
  import { setParagraphAlignment } from "$lib/editor/align";
  import { FONT_SIZES, fontSizeLabel, primaryFamily, resolveFontSize } from "$lib/utils/typography";
  import FontFamilyPicker from "./FontFamilyPicker.svelte";


  interface Props {
    editor: Editor | null;
  }

  let { editor }: Props = $props();

  let canUndo = $state(false);
  let canRedo = $state(false);
  let currentFont = $state(app.settings.defaultFontFamily);

  $effect(() => {
    if (!editor || editor.isDestroyed) {
      canUndo = false;
      canRedo = false;
      return;
    }
    const sync = () => {
      if (editor.isDestroyed) return;
      canUndo = editor.can().undo();
      canRedo = editor.can().redo();
      const attrs = editor.getAttributes("textStyle");
      currentFont = (attrs.fontFamily as string | undefined) ?? app.settings.defaultFontFamily;
    };
    sync();
    editor.on("transaction", sync);
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("transaction", sync);
      editor.off("selectionUpdate", sync);
    };
  });

  $effect(() => {
    void app.settings.defaultFontFamily;
    if (editor && !editor.isDestroyed) {
      const attrs = editor.getAttributes("textStyle");
      if (!attrs.fontFamily) currentFont = app.settings.defaultFontFamily;
    } else {
      currentFont = app.settings.defaultFontFamily;
    }
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

    editor.chain().focus().setFontFamily(cssValue).run();
    currentFont = cssValue;
  }

  function applyFontSize(val: string) {
    if (!editor) return;
    editor.chain().focus().setFontSize(val).run();
  }

  function align(alignment: "left" | "center" | "right" | "justify") {
    if (!editor) return;
    setParagraphAlignment(editor, alignment);
  }
</script>

<div class="toolbar" class:editor-mode={app.mode === "editor"} class:author-mode={app.mode === "author"}>
  {#if app.mode === "author"}
    <FontFamilyPicker compact value={currentFont} onchange={(v) => void applyFont(v)} />

    <select
      class="tool-select narrow"
      value={resolveFontSize(app.settings.defaultFontSize)}
      onchange={(e) => applyFontSize((e.currentTarget as HTMLSelectElement).value)}
    >
      {#each FONT_SIZES as size}
        <option value={size}>{fontSizeLabel(size)}</option>
      {/each}
    </select>

    <div class="sep"></div>

    <button class="tool-btn" title="Bold (Ctrl+B)" onclick={cmd(() => editor?.chain().focus().toggleBold().run())}>
      <strong>B</strong>
    </button>
    <button class="tool-btn" title="Italic (Ctrl+I)" onclick={cmd(() => editor?.chain().focus().toggleItalic().run())}>
      <em>I</em>
    </button>
    <button class="tool-btn" title="Underline (Ctrl+U)" onclick={cmd(() => editor?.chain().focus().toggleUnderline().run())}>
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