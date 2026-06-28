<script lang="ts">
  import Modal from "../Modal.svelte";

  interface Props {
    libraryName: string;
    libraryPath: string;
    removing: boolean;
    onClose: () => void;
    onConfirm: (removeFromDisk: boolean) => void;
  }

  let {
    libraryName,
    libraryPath,
    removing,
    onClose,
    onConfirm,
  }: Props = $props();

  let removeFromDisk = $state(false);
</script>

<Modal title="Remove library?" critical onClose={onClose}>
  <p class="message">
    Remove <strong>{libraryName}</strong> from DarkText? It will no longer appear on the welcome
    screen.
  </p>
  <p class="path">{libraryPath}</p>

  <label class="disk-option">
    <input type="checkbox" bind:checked={removeFromDisk} disabled={removing} />
    <span>
      Remove from computer too? (this will place it in your recycling bin)
    </span>
  </label>

  <div class="actions">
    <button type="button" class="btn" disabled={removing} onclick={onClose}>Cancel</button>
    <button
      type="button"
      class="btn primary"
      class:danger={removeFromDisk}
      disabled={removing}
      onclick={() => onConfirm(removeFromDisk)}
    >
      {removing ? "Removing…" : removeFromDisk ? "Move to Recycle Bin" : "Remove from list"}
    </button>
  </div>
</Modal>

<style>
  .message {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .message strong {
    color: var(--text-primary);
    font-weight: 500;
  }

  .path {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 14px;
    word-break: break-all;
  }

  .disk-option {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.45;
    margin-bottom: 16px;
    cursor: pointer;
  }

  .disk-option input {
    margin-top: 2px;
    accent-color: var(--accent);
    flex-shrink: 0;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    background: var(--bg-surface);
    color: var(--text-secondary);
  }

  .btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  .btn.primary.danger:hover:not(:disabled) {
    background: rgba(196, 92, 92, 0.2);
    color: #f0b0b0;
  }
</style>