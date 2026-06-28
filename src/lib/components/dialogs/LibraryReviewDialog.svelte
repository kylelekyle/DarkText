<script lang="ts">
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
  import * as api from "$lib/api";
  import { formatError } from "$lib/utils/errors";
  import type { LibraryReviewSummary } from "$lib/types";

  let loading = $state(true);
  let summary = $state<LibraryReviewSummary | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    if (app.activeDialog !== "libraryReview" || !app.library) return;
    loading = true;
    error = null;
    void api
      .getLibraryReviewSummary(app.library.path)
      .then((data) => {
        summary = data;
      })
      .catch((e) => {
        error = formatError(e);
        summary = null;
      })
      .finally(() => {
        loading = false;
      });
  });
</script>

<Modal title="Manuscript Review Summary" wide onClose={() => app.closeDialog()}>
  <div class="review-summary">
    {#if loading}
      <p class="muted">Scanning library…</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if summary}
      <div class="totals">
        <span><strong>{summary.totalOpenComments}</strong> open comments</span>
        <span class="sep">·</span>
        <span><strong>{summary.totalPendingChanges}</strong> pending changes</span>
      </div>

      {#if summary.chapters.length === 0}
        <p class="muted">No open comments or pending changes across the library.</p>
      {:else}
        <ul class="chapter-list">
          {#each summary.chapters as row (row.chapterId + row.section)}
            <li>
              <button
                type="button"
                class="row-btn"
                onclick={() => app.openChapterFromReview(row.chapterId, row.section)}
              >
                <span class="title">{row.title}</span>
                <span class="meta">{row.section}</span>
                <span class="counts">
                  {#if row.openComments > 0}
                    {row.openComments} comment{row.openComments === 1 ? "" : "s"}
                  {/if}
                  {#if row.openComments > 0 && row.pendingChanges > 0}
                    ·
                  {/if}
                  {#if row.pendingChanges > 0}
                    {row.pendingChanges} change{row.pendingChanges === 1 ? "" : "s"}
                  {/if}
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
</Modal>

<style>
  .totals {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 14px;
  }

  .sep {
    opacity: 0.4;
  }

  .chapter-list {
    list-style: none;
    max-height: 320px;
    overflow-y: auto;
  }

  .row-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    gap: 2px;
  }

  .row-btn:hover {
    background: var(--bg-hover);
  }

  .title {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .meta {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .counts {
    font-size: 11px;
    color: var(--accent-hover);
  }

  .muted {
    font-size: 12px;
    color: var(--text-muted);
  }

  .error {
    font-size: 12px;
    color: var(--danger);
  }
</style>