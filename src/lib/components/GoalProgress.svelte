<script lang="ts">
  import { goalProgress } from "$lib/utils/stats";

  interface Props {
    current: number;
    goal: number;
    compact?: boolean;
    showCounts?: boolean;
  }

  let { current, goal, compact = false, showCounts = true }: Props = $props();

  const pct = $derived(goalProgress(current, goal));
</script>

{#if goal > 0}
  <div class="goal" class:compact>
    {#if showCounts}
      <div class="goal-header">
        <span class="goal-counts">
          {current.toLocaleString()}
          <span class="sep">/</span>
          {goal.toLocaleString()}
        </span>
        <span class="goal-pct">{pct}%</span>
      </div>
    {/if}
    <div class="goal-track" title="{current.toLocaleString()} of {goal.toLocaleString()} words">
      <div class="goal-fill" style="width: {pct}%"></div>
    </div>
  </div>
{/if}

<style>
  .goal {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .goal.compact {
    gap: 3px;
  }

  .goal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 10px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .goal-counts {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sep {
    color: var(--text-faint);
    margin: 0 2px;
  }

  .goal-pct {
    color: var(--accent-hover);
    font-weight: 600;
    flex-shrink: 0;
  }

  .goal-track {
    height: 4px;
    background: var(--border-subtle);
    border-radius: 2px;
    overflow: hidden;
  }

  .goal.compact .goal-track {
    height: 3px;
  }

  .goal-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-dim), var(--accent-hover));
    border-radius: 2px;
    transition: width 0.4s var(--ease-focus);
  }
</style>