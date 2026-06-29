<script lang="ts">
  import { onDestroy } from "svelte";
  import { app } from "$lib/stores/app.svelte";
  import { sidebarSelection } from "$lib/stores/sidebarSelection.svelte";
  import type { ChapterMeta, ChapterSection } from "$lib/types";
  import { statusBadgeLabel } from "$lib/utils/chapterDisplay";
  import { handleSidebarChapterClick } from "$lib/utils/sidebarSelection";
  import {
    draggedOffsetPx,
    gapPositionFromPointerY,
    reorderByGap,
    shiftOffsetPx,
  } from "$lib/utils/listReorder";

  interface Props {
    section: ChapterSection;
    items: ChapterMeta[];
    totalCount: number;
    filter: string;
    placeholder: string;
    addLabel: string;
    addClass?: string;
    panelClass?: string;
    showStatus?: boolean;
    sectionDotClass?: string;
    sectionDotChar?: string;
    emptyLabel?: string;
    filterInput?: HTMLInputElement | null;
    onItemContextMenu?: (e: MouseEvent, item: ChapterMeta) => void;
  }

  let {
    section,
    items,
    totalCount,
    filter = $bindable(""),
    placeholder,
    addLabel,
    addClass = "",
    panelClass = "",
    showStatus = false,
    sectionDotClass,
    sectionDotChar,
    emptyLabel = "No matching items",
    filterInput = $bindable(null),
    onItemContextMenu,
  }: Props = $props();

  let listFocusId = $state<string | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);
  let draggingId = $state<string | null>(null);
  let dragFromIndex = $state(-1);
  let targetGap = $state(0);
  let smoothGap = $state(0);
  let rowHeight = $state(36);
  let dragRowLayout = $state<{ top: number; height: number }[]>([]);

  let dragCleanup: (() => void) | null = null;
  let gapRaf: number | null = null;
  let suppressClickUntil = 0;

  const DRAG_THRESHOLD_PX = 6;
  const GAP_LERP = 0.2;
  const GAP_SNAP_EPS = 0.004;
  const isFiltering = $derived(filter.trim().length > 0);
  const isDragging = $derived(draggingId !== null);
  $effect(() => {
    sidebarSelection.setSection(section);
    sidebarSelection.pruneMissing(new Set(items.map((c) => c.id)));
  });

  $effect(() => {
    if (app.activeChapterId && app.activeSection === section) {
      listFocusId = app.activeChapterId;
    } else if (listFocusId && !items.some((c) => c.id === listFocusId)) {
      listFocusId = null;
    }
  });

  onDestroy(() => {
    dragCleanup?.();
    stopGapLoop();
  });

  function getFullList(): ChapterMeta[] {
    if (section === "chapters") return [...(app.library?.chapters ?? [])];
    if (section === "research") return [...app.researchChapters];
    return [...app.characterChapters];
  }

  function snapshotRowLayout() {
    if (!listEl) return;
    const layout: { top: number; height: number }[] = [];
    for (const item of items) {
      const row = listEl.querySelector<HTMLElement>(
        `[data-chapter-id="${item.id}"]`,
      );
      const rect = row?.getBoundingClientRect();
      if (rect) layout.push({ top: rect.top, height: rect.height });
    }
    dragRowLayout = layout;
    rowHeight = layout[dragFromIndex]?.height ?? rowHeight;
  }

  function updateGap(clientY: number) {
    targetGap = gapPositionFromPointerY(clientY, dragRowLayout);
  }

  function startGapLoop() {
    stopGapLoop();
    const tick = () => {
      if (draggingId === null) return;
      const diff = targetGap - smoothGap;
      if (Math.abs(diff) > GAP_SNAP_EPS) {
        smoothGap += diff * GAP_LERP;
      } else {
        smoothGap = targetGap;
      }
      gapRaf = requestAnimationFrame(tick);
    };
    gapRaf = requestAnimationFrame(tick);
  }

  function stopGapLoop() {
    if (gapRaf !== null) cancelAnimationFrame(gapRaf);
    gapRaf = null;
  }

  function itemTransform(index: number, id: string, gap: number): string {
    if (!draggingId || dragFromIndex < 0) return "none";
    const offset =
      id === draggingId
        ? draggedOffsetPx(dragFromIndex, gap, rowHeight)
        : shiftOffsetPx(index, dragFromIndex, gap, rowHeight);
    return offset === 0 ? "none" : `translateY(${offset}px)`;
  }

  function clearDragState() {
    draggingId = null;
    dragFromIndex = -1;
    targetGap = 0;
    smoothGap = 0;
    dragRowLayout = [];
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }

  function endDrag(commit: boolean) {
    stopGapLoop();
    const insertGap = Math.round(targetGap);

    if (commit && draggingId) {
      const reordered = reorderByGap(getFullList(), draggingId, insertGap);
      if (reordered) {
        app.reorderChapters(
          reordered.map((c) => c.id),
          section,
        );
        suppressClickUntil = Date.now() + 280;
      }
    }

    settleThenClear(insertGap);
  }

  function settleThenClear(insertGap: number) {
    targetGap = insertGap;
    const step = () => {
      const diff = insertGap - smoothGap;
      if (Math.abs(diff) > 0.025) {
        smoothGap += diff * 0.34;
        requestAnimationFrame(step);
        return;
      }
      clearDragState();
    };
    requestAnimationFrame(step);
  }

  function beginDragSession(id: string, row: HTMLElement) {
    const fromIndex = items.findIndex((c) => c.id === id);
    if (fromIndex < 0 || !listEl) return;

    draggingId = id;
    dragFromIndex = fromIndex;
    targetGap = fromIndex;
    smoothGap = fromIndex;
    rowHeight = row.getBoundingClientRect().height || 36;
    snapshotRowLayout();
    startGapLoop();

    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function onRowPointerDown(e: PointerEvent, id: string) {
    if (isFiltering || e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;

    const row = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;

    const onMove = (ev: PointerEvent) => {
      if (!active) {
        const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (moved < DRAG_THRESHOLD_PX) return;
        active = true;
        ev.preventDefault();
        beginDragSession(id, row);
      }
      updateGap(ev.clientY);
    };

    const onUp = () => {
      if (active) endDrag(true);
      cleanup();
    };

    const onCancel = () => {
      if (active) endDrag(false);
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      dragCleanup = null;
    };

    dragCleanup = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function onItemClick(e: MouseEvent, id: string) {
    if (Date.now() < suppressClickUntil) return;
    const result = handleSidebarChapterClick(e, id, items, sidebarSelection);
    if (result.open) void app.openChapter(result.chapterId, section);
  }

  function deleteSelected() {
    const ids =
      sidebarSelection.section === section ? [...sidebarSelection.selectedIds] : [];
    if (ids.length === 0) return;
    const titles = items.filter((c) => ids.includes(c.id)).map((c) => c.title);
    void app.requestChaptersDelete(ids, section, titles);
  }

  function onFilterKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      const input = e.currentTarget as HTMLInputElement;
      if (input.value) {
        e.preventDefault();
        filter = "";
        return;
      }
      if (sidebarSelection.hasSelection) {
        e.preventDefault();
        sidebarSelection.clear();
      }
      return;
    }
    if (e.key === "ArrowDown" && items.length > 0) {
      e.preventDefault();
      listFocusId = items[0].id;
      (e.currentTarget as HTMLInputElement).blur();
    }
  }

  function onListKeydown(e: KeyboardEvent) {
    if (!items.length) return;

    if (e.key === "Escape" && sidebarSelection.hasSelection) {
      e.preventDefault();
      sidebarSelection.clear();
      return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && sidebarSelection.hasSelection) {
      e.preventDefault();
      deleteSelected();
      return;
    }

    const idx = listFocusId ? items.findIndex((c) => c.id === listFocusId) : -1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      listFocusId = items[Math.min(items.length - 1, idx + 1)].id;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      listFocusId = idx <= 0 ? null : items[idx - 1].id;
    } else if (e.key === "Enter" && listFocusId) {
      e.preventDefault();
      void app.openChapter(listFocusId, section);
    } else if (e.key === "F2" && listFocusId) {
      e.preventDefault();
      app.openRenameForChapter(listFocusId, section);
    }
  }

  function addItem() {
    if (section === "characters") void app.newCharacter();
    else if (section === "research") void app.newChapter(undefined, "research");
    else void app.newChapter();
  }
</script>

<div class="tab-panel {panelClass}">
  <div class="search-wrap">
    <input
      bind:this={filterInput}
      class="filter-input"
      type="search"
      {placeholder}
      bind:value={filter}
      onkeydown={onFilterKeydown}
    />
    {#if filter}
      <button class="search-clear" title="Clear search" onclick={() => (filter = "")}>×</button>
    {/if}
  </div>
  {#if isFiltering}
    <p class="filter-hint">Showing {items.length} of {totalCount}</p>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <ul
    bind:this={listEl}
    class="item-list"
    class:is-dragging={isDragging}
    onkeydown={onListKeydown}
  >
    {#each items as item, index (item.id)}
      <li
        class="list-item"
        class:draggable={!isFiltering}
        class:active={app.activeChapterId === item.id && app.activeSection === section}
        class:selected={sidebarSelection.section === section && sidebarSelection.isSelected(item.id)}
        class:keyboard-focus={listFocusId === item.id}
        class:dragging={draggingId === item.id}
        data-chapter-id={item.id}
        style:transform={itemTransform(index, item.id, smoothGap)}
        onpointerdown={(e) => onRowPointerDown(e, item.id)}
        oncontextmenu={(e) => onItemContextMenu?.(e, item)}
      >
        {#if !isFiltering}
          <span class="drag-handle" aria-hidden="true">⠿</span>
        {/if}
        {#if sectionDotClass && sectionDotChar}
          <span class="section-dot {sectionDotClass}">{sectionDotChar}</span>
        {/if}
        <button class="item-btn" onclick={(e) => onItemClick(e, item.id)}>
          {item.title}
        </button>
        {#if showStatus}
          <span class="status-badge status-{item.status}">
            {statusBadgeLabel(item.status)}
          </span>
        {/if}
      </li>
    {:else}
      <li class="empty">{emptyLabel}</li>
    {/each}
  </ul>
  <button class="add-btn {addClass}" onclick={addItem}>{addLabel}</button>
</div>

<style>
  .tab-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .search-wrap {
    position: relative;
    margin: 8px 12px 4px;
    flex-shrink: 0;
  }

  .filter-input {
    width: 100%;
    font-size: 11px;
    padding: 5px 28px 5px 8px;
  }

  .search-clear {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    font-size: 14px;
    color: var(--text-muted);
    border-radius: 4px;
  }

  .filter-hint {
    font-size: 10px;
    color: var(--text-muted);
    padding: 0 12px 4px;
    font-style: italic;
    flex-shrink: 0;
  }

  .item-list {
    list-style: none;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 10px;
    margin: 1px 6px;
    border-radius: var(--radius-sm);
    position: relative;
    z-index: 0;
  }

  .list-item.draggable {
    cursor: grab;
    touch-action: none;
  }

  .list-item.draggable:active {
    cursor: grabbing;
  }

  .list-item.active {
    background: var(--accent-subtle);
  }

  .list-item.selected {
    background: rgba(201, 165, 92, 0.14);
  }

  .list-item.selected.active {
    background: rgba(201, 165, 92, 0.22);
  }

  .list-item.active .item-btn {
    color: var(--text-primary);
    font-weight: 500;
  }

  .list-item.selected .item-btn {
    color: var(--text-primary);
  }

  .list-item.keyboard-focus {
    outline: 1px solid var(--accent-dim);
    outline-offset: -1px;
  }

  .list-item.dragging {
    opacity: 0.78;
    z-index: 2;
    background: var(--bg-elevated, var(--bg-hover));
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
    transition: opacity 220ms ease-out, box-shadow 220ms ease-out;
  }

  .drag-handle {
    color: var(--text-muted);
    font-size: 10px;
    flex-shrink: 0;
    opacity: 0.35;
    padding: 4px 2px;
    pointer-events: none;
  }

  .list-item:hover .drag-handle {
    opacity: 0.9;
  }

  .item-btn {
    flex: 1;
    text-align: left;
    padding: 7px 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--text-secondary);
    min-width: 0;
    cursor: inherit;
  }

  .status-badge {
    font-size: 8px;
    font-weight: 600;
    padding: 2px 5px;
    border-radius: 3px;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .status-badge.status-draft {
    color: var(--status-draft);
    background: rgba(115, 112, 106, 0.15);
  }

  .status-badge.status-needs-refine {
    color: var(--status-refine);
    background: rgba(201, 149, 58, 0.12);
  }

  .status-badge.status-final {
    color: var(--status-final);
    background: rgba(74, 158, 114, 0.12);
  }

  .section-dot {
    font-size: 7px;
    flex-shrink: 0;
  }

  .research-dot {
    color: var(--research-accent);
  }

  .character-dot {
    color: var(--character-accent);
  }

  .add-btn {
    margin: 8px 12px;
    padding: 8px 10px;
    width: calc(100% - 24px);
    text-align: left;
    font-size: 12px;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .research-add {
    color: var(--research-accent);
  }

  .character-add {
    color: var(--character-accent);
  }

  .empty {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    padding: 8px 12px;
  }
</style>