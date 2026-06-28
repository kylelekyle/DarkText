<script lang="ts">
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
  import * as api from "$lib/api";
  import { formatError } from "$lib/utils/errors";
  import type { LibrarySearchHit } from "$lib/types";

  let query = $state("");
  let searching = $state(false);
  let results = $state<LibrarySearchHit[]>([]);
  let searchInput = $state<HTMLInputElement | null>(null);
  let lastQuery = $state("");

  $effect(() => {
    if (app.activeDialog === "globalSearch") {
      requestAnimationFrame(() => searchInput?.focus());
    }
  });

  async function runSearch() {
    const q = query.trim();
    if (!q || !app.library) {
      results = [];
      return;
    }
    searching = true;
    lastQuery = q;
    try {
      results = await api.searchLibrary(app.library.path, q);
    } catch (e) {
      results = [];
      app.showToast(formatError(e));
    } finally {
      searching = false;
    }
  }

  function openHit(hit: LibrarySearchHit) {
    app.openChapterFromSearch(hit, lastQuery || query.trim());
  }
</script>

<Modal title="Search Library" wide onClose={() => app.closeDialog()}>
  <div class="search-form">
    <label>
      <span>Find across all chapters, research, and characters</span>
      <div class="row">
        <input
          bind:this={searchInput}
          type="search"
          bind:value={query}
          placeholder="Phrase or keyword…"
          onkeydown={(e) => {
            if (e.key === "Enter") void runSearch();
          }}
        />
        <button class="btn primary" disabled={searching || !query.trim()} onclick={() => void runSearch()}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
    </label>

    {#if results.length > 0}
      <ul class="results">
        {#each results as hit (hit.chapterId + hit.section + hit.matchIndex)}
          <li>
            <button type="button" class="hit" onclick={() => openHit(hit)}>
              <span class="hit-title">{hit.title}</span>
              <span class="hit-meta">{hit.section}</span>
              <span class="hit-excerpt">{hit.excerpt}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if query.trim() && !searching}
      <p class="empty">No matches in this library.</p>
    {/if}

    <p class="hint">Opens the chapter and jumps to the first match. Use Read-through (View menu) for linear proofing.</p>
  </div>
</Modal>

<style>
  .search-form label > span {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  .row input {
    flex: 1;
    padding: 8px 10px;
  }

  .results {
    list-style: none;
    margin-top: 12px;
    max-height: 280px;
    overflow-y: auto;
  }

  .hit {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    gap: 2px;
  }

  .hit:hover {
    background: var(--bg-hover);
  }

  .hit-title {
    font-size: 13px;
    color: var(--text-primary);
    font-weight: 500;
  }

  .hit-meta {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .hit-excerpt {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .empty {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
    margin-top: 12px;
  }

  .hint {
    font-size: 10px;
    color: var(--text-faint);
    margin-top: 14px;
    line-height: 1.5;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    background: var(--bg-surface);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .btn.primary {
    border-color: var(--accent-dim);
    background: var(--accent-dim);
    color: var(--text-primary);
  }

  .btn:disabled {
    opacity: 0.5;
  }
</style>