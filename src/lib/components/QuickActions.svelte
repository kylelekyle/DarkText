<script lang="ts">
  import type { Editor } from "@tiptap/core";
  import { buildMenuActions, defaultMenuActionContext } from "$lib/menu/actions";
  import { app } from "$lib/stores/app.svelte";

  interface Props {
    editor: Editor | null;
  }

  let { editor }: Props = $props();

  let query = $state("");
  let selected = $state(0);
  let searchInput = $state<HTMLInputElement | null>(null);

  const actions = $derived(
    buildMenuActions(defaultMenuActionContext(editor, { trackAll: true })),
  );
  const PALETTE_SKIP = new Set([
    "file.export.html",
    "file.export.md",
    "file.export.docx",
    "file.export.text",
    "book.compile.html",
    "book.compile.md",
    "book.compile.txt",
    "book.compile.docx",
    "book.compile.epub",
  ]);

  const filtered = $derived(
    actions.filter((a) => {
      if (PALETTE_SKIP.has(a.id)) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) ||
        a.group?.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    }),
  );

  function close() {
    app.showQuickActions = false;
  }

  function run(index: number) {
    const action = filtered[index];
    if (!action || action.disabled) return;
    action.run?.();
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!app.showQuickActions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selected = Math.min(selected + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(selected);
    } else if (e.key === "Escape") {
      close();
    }
  }

  $effect(() => {
    if (query) selected = 0;
  });

  $effect(() => {
    if (app.showQuickActions) {
      requestAnimationFrame(() => searchInput?.focus());
    }
  });
</script>

<svelte:window onkeydown={onKeydown} />

{#if app.showQuickActions}
  <div class="overlay" role="presentation">
    <button
      type="button"
      class="backdrop"
      aria-label="Close quick actions"
      onclick={close}
    ></button>
    <div
      class="palette"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Actions"
      tabindex="-1"
    >
      <input
        bind:this={searchInput}
        class="search"
        type="text"
        placeholder="Quick Actions…"
        bind:value={query}
      />
      <ul class="list" role="listbox" aria-label="Actions">
        {#each filtered as action, i}
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={i === selected}
              class:selected={i === selected}
              disabled={action.disabled}
              onclick={() => run(i)}
            >
              <span class="label">{action.label}</span>
              <span class="group">{action.group}</span>
              {#if action.shortcut}
                <span class="shortcut">{action.shortcut}</span>
              {/if}
            </button>
          </li>
        {:else}
          <li class="empty" role="presentation">No matching actions</li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 250;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.5);
    cursor: default;
  }

  .palette {
    position: relative;
    z-index: 1;
    width: min(480px, 92vw);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    outline: none;
  }

  .search {
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
    border: none;
    border-bottom: 1px solid var(--border-subtle);
    border-radius: 0;
    background: var(--bg-surface);
  }

  .list {
    list-style: none;
    max-height: 320px;
    overflow-y: auto;
    padding: 4px;
  }

  .list button {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    font-size: 13px;
    border-radius: 4px;
    color: var(--text-primary);
  }

  .list button:hover:not(:disabled),
  .list button.selected {
    background: var(--bg-hover);
  }

  .group {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  .shortcut {
    font-size: 10px;
    color: var(--text-muted);
  }

  .empty {
    padding: 16px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }
</style>