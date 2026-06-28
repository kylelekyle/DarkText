<script lang="ts">
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
</script>

{#if app.confirmDialog}
  {#key app.confirmGeneration}
    <Modal title={app.confirmDialog.title} critical onClose={() => app.resolveConfirm(false)}>
      <p class="message" class:destructive={app.confirmDialog.destructive}>
        {app.confirmDialog.message}
      </p>
      <div class="actions">
        <button type="button" class="btn" onclick={() => app.resolveConfirm(false)}>
          {app.confirmDialog.cancelLabel ?? "Cancel"}
        </button>
        <button
          type="button"
          class="btn primary"
          class:danger={app.confirmDialog.destructive}
          onclick={() => app.resolveConfirm(true)}
        >
          {app.confirmDialog.confirmLabel ?? "Confirm"}
        </button>
      </div>
    </Modal>
  {/key}
{/if}

<style>
  .message {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .message.destructive {
    color: var(--text-primary);
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    background: var(--bg-surface);
    color: var(--text-secondary);
  }

  .btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn.primary {
    background: var(--accent-subtle);
    border-color: var(--accent-dim);
    color: var(--text-primary);
  }

  .btn.primary.danger {
    background: rgba(196, 92, 92, 0.12);
    border-color: rgba(196, 92, 92, 0.45);
    color: #e8a0a0;
  }

  .btn.primary.danger:hover {
    background: rgba(196, 92, 92, 0.2);
    color: #f0b0b0;
  }
</style>