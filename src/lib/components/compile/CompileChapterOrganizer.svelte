<script lang="ts">
  import CompileChapterOrganizerDialog from "./CompileChapterOrganizerDialog.svelte";
  import CompileChapterList from "./CompileChapterList.svelte";
  import { app } from "$lib/stores/app.svelte";
  import type { ChapterMeta, LibraryPreferences } from "$lib/types";
  import {
    compileShowChapterNumbers,
    compileShowChapterTitles,
  } from "$lib/utils/compileUtils";

  interface Props {
    chapters: ChapterMeta[];
    onSave: (chapterIds: string[]) => void;
  }

  let { chapters, onSave }: Props = $props();

  let dialogOpen = $state(false);

  const count = $derived(chapters.length);
  const prefs = $derived(app.bookSettings.preferences);
  const showNumbers = $derived(compileShowChapterNumbers(prefs));
  const showTitles = $derived(compileShowChapterTitles(prefs));

  function openDialog() {
    if (count === 0) return;
    dialogOpen = true;
  }

  async function updateDisplayPref(
    key: keyof Pick<
      LibraryPreferences,
      "compileShowChapterNumbers" | "compileShowChapterTitles"
    >,
    value: boolean,
  ) {
    await app.saveBookSettings({
      ...app.bookSettings,
      preferences: {
        ...app.bookSettings.preferences,
        [key]: value,
      },
    });
  }
</script>

<div class="compile-organize-wrap">
  <div class="header-row">
    <div class="summary">
      {#if count === 0}
        <span class="warn">No Final chapters — mark chapters as Final in the sidebar.</span>
      {:else}
        <span class="count">{count} Final {count === 1 ? "chapter" : "chapters"}</span>
      {/if}
    </div>

    <button
      type="button"
      class="organize-btn"
      disabled={count === 0}
      onclick={openDialog}
    >
      Organize chapters…
    </button>
  </div>

  {#if count > 0}
    <div class="display-options" role="group" aria-label="Compile chapter headings">
      <label class="display-toggle">
        <input
          type="checkbox"
          checked={showNumbers}
          onchange={(e) =>
            void updateDisplayPref(
              "compileShowChapterNumbers",
              e.currentTarget.checked,
            )}
        />
        Chapter numbers
      </label>
      <label class="display-toggle">
        <input
          type="checkbox"
          checked={showTitles}
          onchange={(e) =>
            void updateDisplayPref(
              "compileShowChapterTitles",
              e.currentTarget.checked,
            )}
        />
        Chapter titles
      </label>
      <span class="display-hint">Affects the list and compiled export headings.</span>
    </div>

    <CompileChapterList
      items={chapters}
      {showNumbers}
      {showTitles}
      readOnly
      showHeader={false}
    />
  {/if}
</div>

{#if dialogOpen}
  <CompileChapterOrganizerDialog
    {chapters}
    {showNumbers}
    {showTitles}
    onSave={onSave}
    onClose={() => (dialogOpen = false)}
  />
{/if}

<style>
  .compile-organize-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--bg-surface);
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .summary {
    flex: 1;
    min-width: 0;
  }

  .count {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .warn {
    font-size: 12px;
    color: var(--status-refine);
    line-height: 1.4;
  }

  .display-options {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
  }

  .display-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
  }

  .display-toggle input {
    margin: 0;
  }

  .display-hint {
    flex: 1 1 100%;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .organize-btn {
    flex-shrink: 0;
    padding: 6px 12px;
    font-size: 12px;
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    white-space: nowrap;
  }

  .organize-btn:hover:not(:disabled) {
    border-color: var(--accent-dim);
    color: var(--text-primary);
    background: var(--accent-subtle);
  }

  .organize-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .compile-organize-wrap :global(.chapter-list-wrap) {
    margin-bottom: 0;
  }

  .compile-organize-wrap :global(.chapter-list) {
    max-height: min(36vh, 280px);
  }
</style>