<script lang="ts">
  interface Props {
    path: string;
    x: number;
    y: number;
    onOpen: (path: string) => void;
    onRequestRemove: (path: string) => void;
    onClose: () => void;
  }

  let { path, x, y, onOpen, onRequestRemove, onClose }: Props = $props();

  function runMenuAction(fn: () => void) {
    fn();
    onClose();
  }

  function onMenuKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<div
  class="context-menu"
  style="left: {x}px; top: {y}px"
  role="menu"
  tabindex="-1"
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  onkeydown={onMenuKeydown}
>
  <button type="button" role="menuitem" onclick={() => runMenuAction(() => onOpen(path))}>
    Open
  </button>
  <button
    type="button"
    role="menuitem"
    class="danger"
    onclick={() => runMenuAction(() => onRequestRemove(path))}
  >
    Remove library…
  </button>
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 200;
    min-width: 160px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    outline: none;
    animation: menu-in 0.14s var(--ease-focus);
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(-2px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .context-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--text-primary);
    border-radius: 4px;
  }

  .context-menu button:hover {
    background: var(--bg-hover);
  }

  .context-menu button.danger {
    color: #e8a0a0;
  }

  .context-menu button.danger:hover {
    background: rgba(196, 92, 92, 0.12);
    color: #f0b0b0;
  }
</style>