<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { loadChaptersBulk, stripForPublish } from "$lib/export/pipeline";
  import { sanitizeHtmlForDisplay } from "$lib/export/sanitizeHtml";
  import { formatError } from "$lib/utils/errors";
  import type { ChapterMeta } from "$lib/types";

  type Section = { meta: ChapterMeta; html: string };

  let loading = $state(true);
  let error = $state<string | null>(null);
  let sections = $state<Section[]>([]);

  $effect(() => {
    const library = libraryStore.library;
    const finalOnly = app.readThroughFinalOnly;
    if (!app.showReadThrough || !library) return;

    loading = true;
    error = null;
    sections = [];

    const list = finalOnly
      ? library.chapters.filter((c) => c.status === "final")
      : library.chapters;

    void (async () => {
      try {
        const loaded = await loadChaptersBulk(library.path, list, "chapters");
        sections = await Promise.all(
          loaded.map(async (c) => ({
            meta: c.meta,
            html: sanitizeHtmlForDisplay(await stripForPublish(c.html)),
          })),
        );
      } catch (e) {
        error = formatError(e);
      } finally {
        loading = false;
      }
    })();
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === "Escape" && app.showReadThrough) app.showReadThrough = false;
  }}
/>

<div class="readthrough-overlay" role="presentation">
  <div class="readthrough-panel">
    <header class="header">
      <div>
        <h2>Read-through</h2>
        <p class="hint">Continuous scroll · {app.readThroughFinalOnly ? "Final chapters only" : "All chapters"}</p>
      </div>
      <div class="tools">
        <label class="toggle">
          <input type="checkbox" bind:checked={app.readThroughFinalOnly} />
          Final only
        </label>
        <button class="close-btn" title="Close (Esc)" onclick={() => (app.showReadThrough = false)}>×</button>
      </div>
    </header>

    <div class="content">
      {#if loading}
        <p class="status">Loading manuscript…</p>
      {:else if error}
        <p class="status error">{error}</p>
      {:else if sections.length === 0}
        <p class="status">
          {app.readThroughFinalOnly
            ? "No Final chapters. Mark chapters as Final in the sidebar."
            : "No chapters in this library."}
        </p>
      {:else}
        {#each sections as section (section.meta.id)}
          <article class="chapter-block">
            <h3 class="chapter-title">{section.meta.title}</h3>
            <div class="chapter-body">{@html section.html}</div>
          </article>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .readthrough-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 180;
    display: flex;
  }

  .readthrough-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-deep);
    overflow: hidden;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-chrome);
    flex-shrink: 0;
  }

  .header h2 {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .hint {
    font-size: 11px;
    color: var(--text-faint);
  }

  .tools {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    font-size: 18px;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 48px;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
  }

  .status {
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    margin-top: 40px;
  }

  .status.error {
    color: var(--danger);
  }

  .chapter-block {
    margin-bottom: 3rem;
  }

  .chapter-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .chapter-body {
    font-family: Georgia, serif;
    font-size: 1.05rem;
    line-height: 1.75;
    color: var(--text-primary);
  }

  .chapter-body :global(p) {
    margin: 0 0 0.85em;
  }

  .chapter-body :global(h2) {
    font-size: 1.15rem;
    margin: 1.5em 0 0.5em;
  }
</style>