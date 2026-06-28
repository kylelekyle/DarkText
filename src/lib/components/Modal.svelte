<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    title: string;
    onClose: () => void;
    children?: import("svelte").Snippet;
    wide?: boolean;
    /** Renders above other modals (e.g. nested dialogs). */
    stacked?: boolean;
    /** Renders above stacked modals (e.g. confirm prompts). */
    critical?: boolean;
  }

  let { title, onClose, children, wide = false, stacked = false, critical = false }: Props = $props();

  let modalEl = $state<HTMLDivElement | null>(null);
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

  function focusableIn(root: HTMLElement): HTMLElement[] {
    return [
      ...root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.offsetParent !== null || el === modalEl);
  }

  function onEscape(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (stacked || critical) {
      e.stopImmediatePropagation();
    }
    onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onEscape(e);
      return;
    }
    if (e.key !== "Tab" || !modalEl) return;
    const items = focusableIn(modalEl);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    modalEl?.focus();
  });
</script>

<svelte:window
  onkeydown={onKeydown}
  onkeydowncapture={stacked || critical ? onEscape : undefined}
/>

<div class="overlay" class:stacked class:critical role="presentation">
  <button type="button" class="backdrop" aria-label="Close dialog" onclick={onClose}></button>
  <div
    bind:this={modalEl}
    class="modal"
    class:wide
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    tabindex="-1"
  >
    <header class="modal-header">
      <h2 id={titleId}>{title}</h2>
      <button type="button" class="close" aria-label="Close" onclick={onClose}>×</button>
    </header>
    <div class="modal-body">
      {@render children?.()}
    </div>
  </div>
</div>

<style>
  .overlay {
    animation: fade-in 0.22s ease;
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 400;
  }

  .overlay.stacked {
    z-index: 500;
  }

  .overlay.critical {
    z-index: 600;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.55);
    cursor: default;
  }

  .modal {
    position: relative;
    z-index: 1;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: min(420px, 92vw);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    animation: modal-in 0.3s var(--ease-focus);
    outline: none;
  }

  @keyframes modal-in {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(6px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal :global(button:active:not(:disabled)) {
    transform: none;
  }

  .modal.wide {
    width: min(560px, 92vw);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .modal-header h2 {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .close {
    font-size: 20px;
    color: var(--text-muted);
    line-height: 1;
    padding: 0 4px;
  }

  .close:hover {
    color: var(--text-primary);
  }

  .modal-body {
    padding: 16px;
    overflow-y: auto;
  }
</style>