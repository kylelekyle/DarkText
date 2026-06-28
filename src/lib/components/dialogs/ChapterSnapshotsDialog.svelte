<script lang="ts">
  import { onMount } from "svelte";
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
  import * as api from "$lib/api";
  import { formatError } from "$lib/utils/errors";
  import type { ChapterSnapshot } from "$lib/types";

  let snapshots = $state<ChapterSnapshot[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let restoring = $state<string | null>(null);

  onMount(() => {
    void load();
  });

  async function load() {
    if (!app.library || !app.activeChapterId) return;
    loading = true;
    error = null;
    try {
      snapshots = await api.listChapterSnapshots(
        app.library.path,
        app.activeChapterId,
        app.activeSection,
      );
    } catch (e) {
      error = formatError(e);
    } finally {
      loading = false;
    }
  }

  async function saveSnapshot() {
    if (!app.library || !app.activeChapterId) return;
    try {
      await app.flushSave();
      const snap = await api.saveChapterSnapshot(
        app.library.path,
        app.activeChapterId,
        app.activeSection,
      );
      snapshots = [snap, ...snapshots.filter((s) => s.id !== snap.id)];
      app.showToast("Snapshot saved");
    } catch (e) {
      app.showToast(formatError(e));
    }
  }

  async function restore(snap: ChapterSnapshot) {
    if (!app.library || !app.activeChapterId) return;
    const ok = await app.confirm(
      `Replace the current chapter with the version from ${new Date(snap.createdAt).toLocaleString()}? Unsaved changes will be lost.`,
      "Restore snapshot?",
      { confirm: "Restore", cancel: "Cancel" },
    );
    if (!ok) return;

    restoring = snap.id;
    try {
      const content = await api.restoreChapterSnapshot(
        app.library.path,
        app.activeChapterId,
        snap.id,
        app.activeSection,
      );
      await app.reloadActiveChapter(content);
      app.showToast("Snapshot restored");
      app.closeDialog();
    } catch (e) {
      app.showToast(formatError(e));
    } finally {
      restoring = null;
    }
  }

  function formatWhen(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }
</script>

<Modal title="Chapter snapshots" onClose={() => app.closeDialog()}>
  <div class="snapshots">
    <p class="hint">
      Snapshots are stored in your Library folder under <code>snapshots/</code> (up to 30 per chapter).
    </p>

    <div class="toolbar">
      <button type="button" class="btn primary" onclick={() => void saveSnapshot()}>
        Save snapshot now
      </button>
    </div>

    {#if loading}
      <p class="status">Loading…</p>
    {:else if error}
      <p class="status error">{error}</p>
    {:else if snapshots.length === 0}
      <p class="status">No snapshots yet for this chapter.</p>
    {:else}
      <ul class="list">
        {#each snapshots as snap (snap.id)}
          <li>
            <div class="meta">
              <span class="when">{formatWhen(snap.createdAt)}</span>
              <span class="counts">{snap.wordCount.toLocaleString()} words</span>
            </div>
            <button
              type="button"
              class="btn"
              disabled={restoring === snap.id}
              onclick={() => void restore(snap)}
            >
              {restoring === snap.id ? "Restoring…" : "Restore"}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="actions">
      <button type="button" class="btn" onclick={() => app.closeDialog()}>Close</button>
    </div>
  </div>
</Modal>

<style>
  .snapshots {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 360px;
  }

  .hint {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.45;
  }

  .toolbar {
    display: flex;
    justify-content: flex-start;
  }

  .status {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .status.error {
    color: var(--danger);
  }

  .list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 280px;
    overflow-y: auto;
  }

  .list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .when {
    font-size: 12px;
    color: var(--text-primary);
  }

  .counts {
    font-size: 11px;
    color: var(--text-muted);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
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

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>