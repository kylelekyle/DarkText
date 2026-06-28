<script lang="ts">
  interface Props {
    recent: string[];
    loading: boolean;
    onOpen: (path: string) => void;
    onRequestRemove: (path: string) => void;
    onContextMenu: (e: MouseEvent, path: string) => void;
    libraryLabel: (path: string) => string;
  }

  let { recent, loading, onOpen, onRequestRemove, onContextMenu, libraryLabel }: Props = $props();
</script>

{#if recent.length > 0}
  <div class="recent-section">
    <h3>Recent Libraries</h3>
    <ul class="recent-list">
      {#each recent as path, i}
        <li class="recent-row">
          <button
            class="recent-item"
            class:highlight={i === 0}
            onclick={() => onOpen(path)}
            oncontextmenu={(e) => onContextMenu(e, path)}
            disabled={loading}
          >
            <span class="recent-icon" aria-hidden="true"></span>
            <span class="recent-text">
              <span class="recent-name">{libraryLabel(path)}</span>
              <span class="recent-path">{path}</span>
            </span>
            {#if i === 0}
              <span class="recent-badge">Last</span>
            {/if}
          </button>
          <button
            type="button"
            class="recent-remove"
            aria-label="Remove {libraryLabel(path)} from recent libraries"
            title="Remove library"
            disabled={loading}
            onclick={() => onRequestRemove(path)}
          >
            ×
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .recent-section {
    margin-top: 24px;
    width: 100%;
    max-width: 480px;
  }

  .recent-section h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 10px;
  }

  .recent-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .recent-row {
    display: flex;
    align-items: stretch;
    gap: 6px;
  }

  .recent-item {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-surface);
    text-align: left;
    cursor: pointer;
    transition: border-color var(--transition-smooth);
  }

  .recent-item:hover:not(:disabled) {
    border-color: var(--accent-dim);
  }

  .recent-item.highlight {
    border-color: var(--accent-dim);
  }

  .recent-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .recent-remove {
    flex-shrink: 0;
    width: 36px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-surface);
    color: var(--text-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    transition: border-color var(--transition-smooth), color var(--transition-smooth),
      background var(--transition-smooth);
  }

  .recent-remove:hover:not(:disabled) {
    border-color: rgba(196, 92, 92, 0.45);
    color: #e8a0a0;
    background: rgba(196, 92, 92, 0.08);
  }

  .recent-remove:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .recent-icon {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-dim);
    flex-shrink: 0;
  }

  .recent-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recent-name {
    font-size: 13px;
    color: var(--text-primary);
  }

  .recent-path {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recent-badge {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-hover);
    padding: 2px 6px;
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius-sm);
  }

</style>