<script lang="ts">
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";

  let text = $state("");

  async function submit() {
    if (!text.trim()) return;
    await app.addComment(text.trim(), app.pendingCommentMarkId);
    app.closeDialog();
  }
</script>

<Modal title="Add Comment" onClose={() => app.closeDialog()}>
  <div class="form">
    {#if app.pendingCommentAnchor}
      <p class="anchor">"{app.pendingCommentAnchor}"</p>
    {/if}
    <label>
      <span>Comment</span>
      <textarea bind:value={text} rows="4" placeholder="Your note…"></textarea>
    </label>
    <div class="actions">
      <button class="btn" onclick={() => app.closeDialog()}>Cancel</button>
      <button class="btn primary" onclick={() => void submit()}>Add</button>
    </div>
  </div>
</Modal>

<style>
  .anchor {
    font-size: 12px;
    color: var(--text-muted);
    font-style: italic;
    margin-bottom: 10px;
    padding: 8px;
    background: var(--bg-surface);
    border-radius: 4px;
  }

  label span {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  textarea {
    width: 100%;
    padding: 8px;
    resize: vertical;
    font-family: inherit;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    background: var(--bg-surface);
  }

  .btn.primary {
    background: var(--accent-dim);
    border-color: var(--accent-dim);
    color: var(--text-primary);
  }
</style>