<script lang="ts">
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
  import { KEYBOARD_SHORTCUTS } from "$lib/utils/shortcuts";
</script>

<Modal title="Keyboard Shortcuts" onClose={() => app.closeDialog()}>
  <ul class="shortcut-list">
    {#each KEYBOARD_SHORTCUTS as s}
      <li>
        <span class="keys">{s.keys}</span>
        <span class="action">{s.action}</span>
      </li>
    {/each}
  </ul>
  <p class="hint">Open Quick Actions with <kbd>Ctrl+P</kbd> and type any command name.</p>
</Modal>

<style>
  .shortcut-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shortcut-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 12px;
  }

  .keys {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: var(--accent-hover);
    background: var(--accent-subtle);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .action {
    color: var(--text-secondary);
  }

  .hint {
    margin-top: 14px;
    font-size: 11px;
    color: var(--text-faint);
  }

  kbd {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: var(--bg-surface);
  }
</style>