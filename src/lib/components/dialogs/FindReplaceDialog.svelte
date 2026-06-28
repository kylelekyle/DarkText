<script lang="ts">
  import type { Editor } from "@tiptap/core";
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
  import {
    findInDocument,
    replaceAllInDocument,
    replaceOneInDocument,
  } from "$lib/editor/search";

  interface Props {
    editor: Editor | null;
  }

  let { editor }: Props = $props();

  let findText = $state("");
  let replaceText = $state("");
  let message = $state("");
  let searchFrom = $state(0);
  let caseSensitive = $state(false);

  const findOptions = () => ({ caseSensitive });

  function findNext() {
    if (!editor || !findText.trim()) return;
    const match = findInDocument(editor, findText, searchFrom, findOptions());
    if (!match) {
      const wrap = findInDocument(editor, findText, 0, findOptions());
      if (!wrap) {
        message = "Not found";
        searchFrom = 0;
        return;
      }
      editor.chain().focus().setTextSelection(wrap).run();
      searchFrom = wrap.to;
      message = "Found (wrapped)";
      return;
    }
    editor.chain().focus().setTextSelection(match).run();
    searchFrom = match.to;
    message = "Found";
  }

  function replaceOne() {
    if (!editor || !findText.trim()) return;
    let match = findInDocument(editor, findText, searchFrom, findOptions());
    let wrapped = false;
    if (!match) {
      match = findInDocument(editor, findText, 0, findOptions());
      wrapped = true;
    }
    if (!match) {
      message = "No matches";
      searchFrom = 0;
      return;
    }
    if (
      !replaceOneInDocument(
        editor,
        findText,
        replaceText,
        match.from,
        findOptions(),
      )
    ) {
      message = "No matches";
      return;
    }
    message = wrapped ? "Replaced (wrapped)" : "Replaced";
    searchFrom = match.from + replaceText.length;
  }

  function replaceAll() {
    if (!editor || !findText.trim()) return;
    const count = replaceAllInDocument(
      editor,
      findText,
      replaceText,
      findOptions(),
    );
    if (count === 0) {
      message = "No matches";
      return;
    }
    searchFrom = 0;
    message = `Replaced ${count} occurrence${count === 1 ? "" : "s"}`;
  }
</script>

<Modal title="Find & Replace" onClose={() => app.closeDialog()}>
  <div class="form">
    <label>
      <span>Find</span>
      <input type="text" bind:value={findText} placeholder="Search text…" />
    </label>
    <label>
      <span>Replace with</span>
      <input type="text" bind:value={replaceText} placeholder="Replacement…" />
    </label>
    <label class="checkbox">
      <input type="checkbox" bind:checked={caseSensitive} />
      <span>Match case</span>
    </label>
    {#if app.trackChanges}
      <p class="track-note">
        Track changes is on — each replacement will be recorded as an edit in the Review panel.
      </p>
    {/if}
    {#if message}
      <p class="msg">{message}</p>
    {/if}
    <div class="actions">
      <button class="btn" onclick={() => app.closeDialog()}>Close</button>
      <button class="btn" onclick={findNext}>Find Next</button>
      <button class="btn" onclick={replaceOne}>Replace</button>
      <button class="btn primary" onclick={replaceAll}>Replace All</button>
    </div>
  </div>
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  label span {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  label.checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  label.checkbox span {
    margin: 0;
    text-transform: none;
    letter-spacing: normal;
    font-size: 12px;
    color: var(--text-secondary);
  }

  label.checkbox input {
    width: auto;
  }

  input {
    width: 100%;
    padding: 8px 10px;
  }

  .track-note {
    font-size: 11px;
    color: var(--accent-hover);
    line-height: 1.45;
    padding: 8px 10px;
    background: var(--accent-subtle);
    border-radius: var(--radius-sm);
  }

  .msg {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--bg-surface);
  }

  .btn.primary {
    border-color: var(--accent-dim);
    background: var(--accent-dim);
    color: var(--text-primary);
  }
</style>