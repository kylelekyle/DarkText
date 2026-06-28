<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
</script>

<footer class="sidebar-footer">
  <button
    class="footer-btn"
    class:active={app.focusMode}
    title="Hide distractions, maximize writing space"
    onclick={() => app.toggleFocusMode()}
  >
    <span class="icon">◎</span>
    Focus
  </button>
  <button
    class="footer-btn"
    class:active={app.showMindMap}
    title="Mind-map (Ctrl+M)"
    onclick={() => app.toggleMindMap()}
  >
    <span class="icon">◇</span>
    Mind-map
  </button>
</footer>

<style>
  .sidebar-footer {
    display: flex;
    gap: 2px;
    padding: 8px;
    border-top: 1px solid var(--border-subtle);
    margin-top: auto;
  }

  .footer-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 4px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
    border-radius: 4px;
    transition: color var(--transition-fast), background var(--transition-fast),
      transform var(--transition-fast);
  }

  .footer-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .footer-btn.active {
    color: var(--accent);
    background: var(--accent-subtle);
  }

  .icon {
    font-size: 14px;
    line-height: 1;
  }
</style>