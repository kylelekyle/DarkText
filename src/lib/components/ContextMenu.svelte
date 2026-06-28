<script lang="ts">
  import type { Editor } from "@tiptap/core";
  import { copySelection, cutSelection, pasteIntoEditor } from "$lib/editor/clipboard";
  import { applySpellSuggestion } from "$lib/utils/spellcheck";

  interface Props {
    x: number;
    y: number;
    editor: Editor | null;
    spellWord?: string;
    spellFrom?: number;
    spellTo?: number;
    spellSuggestions?: string[];
    onAddComment?: () => void;
    onClose: () => void;
  }

  let {
    x,
    y,
    editor,
    spellWord,
    spellFrom,
    spellTo,
    spellSuggestions = [],
    onAddComment,
    onClose,
  }: Props = $props();

  const hasSpell = $derived(
    !!spellWord && spellFrom !== undefined && spellTo !== undefined,
  );

  function run(fn: () => void) {
    fn();
    onClose();
  }

  function applySuggestion(suggestion: string) {
    if (!editor || spellFrom === undefined || spellTo === undefined || !spellWord) return;
    const current = editor.state.doc.textBetween(spellFrom, spellTo, "");
    if (current !== spellWord) {
      onClose();
      return;
    }
    run(() => applySpellSuggestion(editor!, spellFrom, spellTo, suggestion));
  }

  function onMenuKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }
</script>

<div
  class="context-menu"
  style="left: {x}px; top: {y}px"
  role="menu"
  tabindex="-1"
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  onkeydown={onMenuKeydown}
>
  {#if hasSpell}
    <div class="spell-header">Spelling: {spellWord}</div>
    {#if spellSuggestions.length > 0}
      {#each spellSuggestions as suggestion (suggestion)}
        <button
          type="button"
          class="spell-suggestion"
          role="menuitem"
          onclick={() => applySuggestion(suggestion)}
        >
          {suggestion}
        </button>
      {/each}
    {:else}
      <div class="spell-empty">No suggestions</div>
    {/if}
    <div class="sep" role="separator"></div>
  {/if}

  <button type="button" role="menuitem" onclick={() => run(() => editor?.chain().focus().toggleBold().run())}>Bold</button>
  <button type="button" role="menuitem" onclick={() => run(() => editor?.chain().focus().toggleItalic().run())}>Italic</button>
  <button type="button" role="menuitem" onclick={() => run(() => editor?.chain().focus().toggleUnderline().run())}>Underline</button>
  <div class="sep" role="separator"></div>
  <button type="button" role="menuitem" onclick={() => run(() => onAddComment?.())}>Add Comment</button>
  <div class="sep" role="separator"></div>
  <button type="button" role="menuitem" onclick={() => run(() => void cutSelection(editor))}>Cut</button>
  <button type="button" role="menuitem" onclick={() => run(() => void copySelection(editor))}>Copy</button>
  <button type="button" role="menuitem" onclick={() => run(() => void pasteIntoEditor(editor))}>Paste</button>
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 200;
    min-width: 140px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    outline: none;
    animation: menu-in 0.14s var(--ease-focus);
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(-2px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .spell-header {
    padding: 5px 10px 3px;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .spell-empty {
    padding: 6px 10px;
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
  }

  .spell-suggestion {
    color: #ff9a6b;
  }

  .spell-suggestion:hover {
    color: #ffb088;
    background: rgba(255, 122, 69, 0.1);
  }

  .context-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--text-primary);
    border-radius: 4px;
  }

  .context-menu button:hover {
    background: var(--bg-hover);
  }

  .sep {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>