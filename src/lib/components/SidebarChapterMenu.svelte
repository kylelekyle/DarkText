<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "$lib/stores/app.svelte";
  import type { ChapterMeta, ChapterSection, ChapterStatus } from "$lib/types";
  import { clampMenuPosition, statusLabelFull } from "$lib/utils/chapterDisplay";

  interface Props {
    x: number;
    y: number;
    chapter: ChapterMeta;
    section: ChapterSection;
    selectedChapters: ChapterMeta[];
    onClose: () => void;
  }

  let { x, y, chapter, section, selectedChapters, onClose }: Props = $props();

  let menuEl = $state<HTMLDivElement | null>(null);
  let showStatus = $state(false);
  let focusIndex = $state(0);

  const pos = $derived(clampMenuPosition(x, y));
  const isBulk = $derived(selectedChapters.length > 1);
  const targetIds = $derived(selectedChapters.map((c) => c.id));
  const targetTitles = $derived(selectedChapters.map((c) => c.title));

  const statuses: { value: ChapterStatus; label: string }[] = [
    { value: "draft", label: "Draft" },
    { value: "needs-refine", label: "Needs Refine" },
    { value: "final", label: "Final" },
  ];

  const statusLabel = $derived(statusLabelFull(chapter.status));

  const menuItems = $derived.by(() => {
    const items: {
      id: string;
      label: string;
      action: () => void;
      danger?: boolean;
      muted?: boolean;
    }[] = [];

    if (!isBulk) {
      items.push({
        id: "open",
        label: "Open",
        action: () => void app.openChapter(chapter.id, section),
      });
      items.push({
        id: "open-split",
        label: "Open in Split View",
        action: () => void app.openChapterInSplit(chapter.id, section),
      });
      items.push({
        id: "rename",
        label: "Rename…",
        action: () => app.openRenameForChapter(chapter.id, section),
      });
    }

    items.push({
      id: "duplicate",
      label: isBulk ? `Duplicate ${selectedChapters.length} chapters` : "Duplicate",
      action: () =>
        isBulk
          ? void app.duplicateChapters(targetIds, section)
          : void app.duplicateChapter(chapter.id, section),
    });
    items.push({
      id: "delete",
      label: isBulk ? `Delete ${selectedChapters.length} chapters` : "Delete",
      danger: true,
      action: () => {},
    });
    return items;
  });

  function run(fn: () => void) {
    fn();
    onClose();
  }

  function handleDelete() {
    if (isBulk) {
      void app.requestChaptersDelete(targetIds, section, targetTitles);
    } else {
      void app.requestChapterDelete(chapter.id, section, chapter.title);
    }
    onClose();
  }

  function applyStatus(status: ChapterStatus) {
    if (isBulk) {
      app.setChaptersStatus(targetIds, status, section);
    } else {
      app.setChapterStatus(chapter.id, status, section);
    }
    onClose();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (showStatus) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusIndex = (focusIndex + 1) % menuItems.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusIndex = (focusIndex - 1 + menuItems.length) % menuItems.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = menuItems[focusIndex];
      if (item.id === "delete") {
        handleDelete();
      } else {
        run(item.action);
      }
    }
  }

  onMount(() => {
    menuEl?.focus();
  });
</script>

<div
  bind:this={menuEl}
  class="context-menu"
  style="left: {pos.x}px; top: {pos.y}px"
  role="menu"
  tabindex="-1"
  onkeydown={onKeydown}
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
>
  <div class="menu-header" title={isBulk ? `${selectedChapters.length} selected` : chapter.title}>
    {#if isBulk}
      {selectedChapters.length} chapters selected
    {:else}
      {chapter.title}
    {/if}
  </div>

  {#each menuItems as item, i (item.id)}
    {#if item.id === "delete"}
      <div class="sep"></div>
    {/if}
    <button
      type="button"
      class:danger={item.danger}
      class:muted={item.muted}
      class:focused={!showStatus && focusIndex === i}
      role="menuitem"
      onclick={(e) => {
        e.stopPropagation();
        if (item.id === "delete") {
          handleDelete();
        } else {
          run(item.action);
        }
      }}
    >
      {item.label}
    </button>
  {/each}

  <div class="sep"></div>
  <div
    class="submenu-wrap"
    role="group"
    onmouseenter={() => (showStatus = true)}
    onmouseleave={() => (showStatus = false)}
  >
    <button type="button" class="has-submenu" aria-haspopup="menu">
      <span>
        {#if isBulk}
          Set status for all
        {:else}
          Status: {statusLabel}
        {/if}
      </span>
      <span class="arrow">›</span>
    </button>
    {#if showStatus}
      <div class="submenu-bridge" aria-hidden="true"></div>
      <div class="submenu" role="menu">
        {#each statuses as status (status.value)}
          <button
            type="button"
            class:active={!isBulk && chapter.status === status.value}
            role="menuitem"
            onclick={() => applyStatus(status.value)}
          >
            <span class={`status-dot status-${status.value}`}></span>
            {status.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 200;
    min-width: 188px;
    max-width: 260px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 4px;
    box-shadow: var(--shadow-md);
    animation: menu-in 0.16s var(--ease-focus);
    outline: none;
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

  .menu-header {
    padding: 6px 10px 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 4px;
  }

  .context-menu button {
    display: flex;
    align-items: center;
    width: 100%;
    text-align: left;
    padding: 7px 10px;
    font-size: 12px;
    color: var(--text-primary);
    border-radius: 4px;
    gap: 8px;
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .context-menu button:hover,
  .context-menu button.focused {
    background: var(--bg-hover);
  }

  .context-menu button.active {
    color: var(--accent-hover);
  }

  .context-menu button.danger {
    color: var(--danger);
  }

  .context-menu button.muted {
    color: var(--text-muted);
    font-size: 11px;
  }

  .has-submenu {
    justify-content: space-between;
  }

  .arrow {
    color: var(--text-muted);
    font-size: 11px;
  }

  .submenu-wrap {
    position: relative;
  }

  .submenu-bridge {
    position: absolute;
    left: 100%;
    top: 0;
    width: 10px;
    height: 100%;
  }

  .submenu {
    position: absolute;
    left: calc(100% + 8px);
    top: 0;
    min-width: 148px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 4px;
    box-shadow: var(--shadow-md);
    animation: menu-in 0.14s var(--ease-focus);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-draft {
    background: var(--status-draft);
  }

  .status-needs-refine {
    background: var(--status-refine);
  }

  .status-final {
    background: var(--status-final);
  }

  .sep {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>