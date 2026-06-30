<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import { reviewStore } from "$lib/stores/review.svelte";

  let replyText = $state<Record<string, string>>({});

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div class="review-panel">
  <section class="block">
    <div class="block-head">
      <span>Comments ({reviewStore.activeThreads.length})</span>
    </div>
    {#if reviewStore.activeThreads.length === 0}
      <p class="empty">No comments. Select text → Review → Add comment…</p>
    {:else}
      <ul class="thread-list">
        {#each reviewStore.activeThreads as thread (thread.id)}
          <li class="thread">
            <button
              type="button"
              class="anchor jump"
              onclick={() => app.scrollToComment(thread.markId)}
              title="Jump to comment in text"
            >
              "{thread.anchorText}"
            </button>
            {#each thread.replies as reply (reply.id)}
              <div class="reply">
                <span class="meta">{reply.author} · {formatTime(reply.createdAt)}</span>
                <p>{reply.text}</p>
              </div>
            {/each}
            <div class="thread-actions">
              <input
                class="reply-input"
                type="text"
                placeholder="Reply…"
                bind:value={replyText[thread.id]}
                onkeydown={(e) => {
                  if (e.key === "Enter" && replyText[thread.id]?.trim()) {
                    void app.replyToThread(thread.id, replyText[thread.id].trim());
                    replyText[thread.id] = "";
                  }
                }}
              />
              <button class="small" onclick={() => void app.resolveThread(thread.id)}>Resolve</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="block">
    <div class="block-head">
      <span>Changes ({reviewStore.pendingChanges.length})</span>
      {#if reviewStore.pendingChanges.length > 0}
        <div class="bulk">
          <button class="small accept" onclick={() => app.acceptAllChanges()}>Accept all</button>
          <button class="small reject" onclick={() => app.rejectAllChanges()}>Reject all</button>
        </div>
      {/if}
    </div>
    {#if !reviewStore.trackChanges && reviewStore.pendingChanges.length === 0}
      <p class="empty">Enable Track changes in Review menu to start.</p>
    {:else if reviewStore.pendingChanges.length === 0}
      <p class="empty">No pending changes.</p>
    {:else}
      <ul class="change-list">
        {#each reviewStore.pendingChanges as change (change.markId)}
          <li class="change" class:insertion={change.type === "insertion"} class:deletion={change.type === "deletion"}>
            <span class="type">{change.type === "insertion" ? "+" : "−"}</span>
            <button
              type="button"
              class="text jump"
              onclick={() => app.scrollToChange(change.markId)}
              title="Jump to change in text"
            >
              {change.text || "(empty)"}
            </button>
            <div class="change-btns">
              <button class="small accept" onclick={() => app.applyChange(change, "accept")}>✓</button>
              <button class="small reject" onclick={() => app.applyChange(change, "reject")}>✕</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .review-panel {
    padding: 4px 0;
  }

  .block {
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
    margin-bottom: 8px;
  }

  .block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .bulk {
    display: flex;
    gap: 4px;
  }

  .empty {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    padding: 4px 12px 8px;
  }

  .thread-list,
  .change-list {
    list-style: none;
  }

  .thread {
    padding: 8px 12px;
    border-left: 2px solid var(--status-refine);
    margin: 0 8px 8px;
    background: var(--bg-elevated);
    border-radius: 0 4px 4px 0;
  }

  .anchor {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 6px;
    text-align: left;
    width: 100%;
  }

  .jump {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }

  .jump:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  .reply {
    margin-bottom: 6px;
  }

  .meta {
    font-size: 9px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .reply p {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .thread-actions {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .reply-input {
    flex: 1;
    font-size: 11px;
    padding: 4px 6px;
  }

  .change {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    font-size: 12px;
  }

  .change.insertion .type {
    color: var(--status-final);
  }

  .change.deletion .type {
    color: var(--danger);
  }

  .text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-secondary);
  }

  .change-btns {
    display: flex;
    gap: 2px;
  }

  .small {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--text-muted);
    background: var(--bg-hover);
  }

  .small.accept {
    color: var(--status-final);
  }

  .small.reject {
    color: var(--danger);
  }
</style>