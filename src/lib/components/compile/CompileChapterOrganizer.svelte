<script lang="ts">
  import CompileChapterOrganizerDialog from "./CompileChapterOrganizerDialog.svelte";
  import type { ChapterMeta } from "$lib/types";

  interface Props {
    chapters: ChapterMeta[];
    onSave: (chapterIds: string[]) => void;
  }

  let { chapters, onSave }: Props = $props();

  let dialogOpen = $state(false);

  const count = $derived(chapters.length);

  function openDialog() {
    if (count === 0) return;
    dialogOpen = true;
  }
</script>

<div class="compile-organize-wrap">
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

{#if dialogOpen}
  <CompileChapterOrganizerDialog
    {chapters}
    onSave={onSave}
    onClose={() => (dialogOpen = false)}
  />
{/if}

<style>
  .compile-organize-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--bg-surface);
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
</style>