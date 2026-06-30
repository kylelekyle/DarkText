<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import ReviewPanel from "./ReviewPanel.svelte";
</script>

{#if app.screen === "workspace" && app.mode === "editor" && !app.focusMode && !app.reviewPanelDismissed}
  <aside class="review-slot" aria-label="Review panel">
    <div class="review-header">
      <span class="review-title">Review</span>
      <button
        class="review-close"
        title="Close review panel"
        onclick={() => app.toggleReviewPanel()}
      >
        ×
      </button>
    </div>
    <div class="review-body">
      <ReviewPanel />
    </div>
  </aside>
{/if}

<style>
  .review-slot {
    position: fixed;
    top: calc(var(--titlebar-height) + 36px + 36px);
    right: 0;
    bottom: 28px;
    width: 280px;
    display: flex;
    flex-direction: column;
    background: var(--bg-elevated);
    border-left: 2px solid var(--accent);
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    z-index: 9999;
    pointer-events: auto;
  }

  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
  }

  .review-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .review-close {
    font-size: 16px;
    line-height: 1;
    color: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .review-close:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  .review-body {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
</style>