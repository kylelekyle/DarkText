<script lang="ts">
  import { tick } from "svelte";
  import { portal } from "$lib/utils/platform";
  import { libraryStore } from "$lib/stores/library.svelte";
  import type { ChapterMeta, ChapterSection } from "$lib/types";
  import { statusBadgeLabel } from "$lib/utils/chapterDisplay";

  interface Props {
    focused: boolean;
    title: string;
    chapterId: string | null;
    section: ChapterSection;
    showPicker?: boolean;
    onFocus: () => void;
    onPick?: (chapterId: string, section: ChapterSection) => void;
  }

  let {
    focused,
    title,
    chapterId,
    section,
    showPicker = false,
    onFocus,
    onPick = () => {},
  }: Props = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);
  let popoverTop = $state(0);
  let popoverLeft = $state(0);
  let popoverWidth = $state(220);

  const items = $derived(itemsForSection(section));
  const displayTitle = $derived(title.trim() || (showPicker ? "Select chapter…" : "No chapter"));

  function itemsForSection(sec: ChapterSection): ChapterMeta[] {
    if (sec === "research") return libraryStore.researchChapters;
    if (sec === "characters") return libraryStore.characterChapters;
    return libraryStore.library?.chapters ?? [];
  }

  function syncPosition() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    popoverTop = rect.bottom + 6;
    popoverLeft = rect.left;
    popoverWidth = Math.min(280, Math.max(200, rect.width + 40), window.innerWidth - rect.left - 12);
  }

  async function togglePicker(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
    if (open) {
      onFocus();
      await tick();
      syncPosition();
    }
  }

  function selectChapter(id: string) {
    open = false;
    onPick(id, section);
  }

  function onWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl?.contains(target) || popoverEl?.contains(target)) return;
    open = false;
  }

  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      open = false;
    }
  }

  $effect(() => {
    if (!open) return;
    syncPosition();
    const onReposition = () => syncPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  });
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="pane-chrome" class:focused class:open bind:this={rootEl}>
  {#if showPicker}
    <button
      type="button"
      class="chrome-pill picker-pill"
      class:open
      title={displayTitle}
      aria-label="Choose chapter"
      aria-expanded={open}
      bind:this={triggerEl}
      onclick={togglePicker}
    >
      <span class="title-text">{displayTitle}</span>
      <span class="chevron" aria-hidden="true">▾</span>
    </button>
  {:else}
    <button
      type="button"
      class="chrome-pill solo"
      class:focused
      title={displayTitle}
      onclick={() => onFocus()}
    >
      <span class="title-text">{displayTitle}</span>
    </button>
  {/if}
</div>

{#if showPicker && open}
  <div
    class="chapter-picker"
    style="top: {popoverTop}px; left: {popoverLeft}px; width: {popoverWidth}px"
    bind:this={popoverEl}
    use:portal={"body"}
    role="listbox"
    aria-label="Chapters"
  >
    {#if items.length === 0}
      <p class="picker-empty">No chapters in this section</p>
    {:else}
      {#each items as item (item.id)}
        <button
          type="button"
          class="picker-item"
          class:active={chapterId === item.id}
          role="option"
          aria-selected={chapterId === item.id}
          onclick={() => selectChapter(item.id)}
        >
          <span class="picker-title">{item.title}</span>
          {#if section === "chapters"}
            <span class="picker-status">{statusBadgeLabel(item.status)}</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .pane-chrome {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
    max-width: calc(100% - 32px);
    pointer-events: none;
  }

  .pane-chrome.open {
    pointer-events: auto;
  }

  .chrome-pill {
    display: flex;
    align-items: stretch;
    max-width: 100%;
    border: 1px solid color-mix(in srgb, var(--border-subtle) 70%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
    opacity: 0.42;
    pointer-events: auto;
    transition: opacity var(--transition-smooth), border-color var(--transition-fast),
      box-shadow var(--transition-fast), background var(--transition-fast);
  }

  :global(.editor-pane:hover) .chrome-pill,
  .pane-chrome.focused .chrome-pill,
  .chrome-pill.open,
  .chrome-pill:focus-within {
    opacity: 1;
    border-color: var(--border);
    background: color-mix(in srgb, var(--bg-elevated) 94%, transparent);
    box-shadow: var(--shadow-md);
  }

  .pane-chrome.focused .chrome-pill {
    border-color: color-mix(in srgb, var(--accent-dim) 55%, var(--border-subtle));
  }

  .chrome-pill.solo,
  .chrome-pill.picker-pill {
    font: inherit;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 11px;
    transition: color var(--transition-fast);
  }

  .chrome-pill.solo {
    padding: 5px 14px;
  }

  .chrome-pill.picker-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 5px 10px 5px 14px;
    text-align: left;
  }

  .chrome-pill.solo:hover,
  .chrome-pill.solo.focused,
  .chrome-pill.picker-pill:hover,
  .chrome-pill.picker-pill.open {
    color: var(--text-primary);
  }

  .title-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .chevron {
    flex-shrink: 0;
    font-size: 10px;
    line-height: 1;
    color: var(--text-muted);
    transition: color var(--transition-fast);
  }

  .chrome-pill.picker-pill:hover .chevron,
  .chrome-pill.picker-pill.open .chevron {
    color: var(--text-secondary);
  }

  .chapter-picker {
    position: fixed;
    z-index: 220;
    max-height: 280px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-elevated);
    box-shadow: var(--shadow-md);
    animation: picker-in 0.14s var(--ease-focus);
  }

  @keyframes picker-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .picker-empty {
    padding: 10px 12px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .picker-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-primary);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .picker-item:hover,
  .picker-item.active {
    background: var(--bg-hover);
  }

  .picker-item.active {
    color: var(--accent-hover);
  }

  .picker-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .picker-status {
    flex-shrink: 0;
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>