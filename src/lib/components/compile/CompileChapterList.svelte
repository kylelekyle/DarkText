<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ChapterMeta } from "$lib/types";
  import {
    draggedOffsetPx,
    gapPositionFromPointerY,
    reorderByGap,
    shiftOffsetPx,
  } from "$lib/utils/listReorder";

  interface Props {
    items: ChapterMeta[];
    onReorder: (chapterIds: string[]) => void;
    showHeader?: boolean;
  }

  let { items, onReorder, showHeader = true }: Props = $props();

  let listEl = $state<HTMLUListElement | null>(null);
  let draggingId = $state<string | null>(null);
  let dragFromIndex = $state(-1);
  let targetGap = $state(0);
  let smoothGap = $state(0);
  let rowHeight = $state(36);
  let dragRowLayout = $state<{ top: number; height: number }[]>([]);

  let dragCleanup: (() => void) | null = null;
  let gapRaf: number | null = null;

  const DRAG_THRESHOLD_PX = 6;
  const GAP_LERP = 0.2;
  const GAP_SNAP_EPS = 0.004;
  const isDragging = $derived(draggingId !== null);

  onDestroy(() => {
    dragCleanup?.();
    stopGapLoop();
  });

  function snapshotRowLayout() {
    if (!listEl) return;
    const layout: { top: number; height: number }[] = [];
    for (const item of items) {
      const row = listEl.querySelector<HTMLElement>(`[data-chapter-id="${item.id}"]`);
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
      const reordered = reorderByGap(items, draggingId, insertGap);
      if (reordered) {
        onReorder(reordered.map((c) => c.id));
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
    if (e.button !== 0) return;

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
</script>

<div class="chapter-list-wrap">
  {#if showHeader}
    <span class="label">Chapters ({items.length})</span>
    <p class="hint">Drag to set compile order. Only Final chapters are included.</p>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <ul bind:this={listEl} class="chapter-list" class:is-dragging={isDragging}>
    {#each items as item, index (item.id)}
      <li
        class="chapter-row"
        class:dragging={draggingId === item.id}
        data-chapter-id={item.id}
        style:transform={itemTransform(index, item.id, smoothGap)}
        onpointerdown={(e) => onRowPointerDown(e, item.id)}
      >
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <span class="order">{index + 1}</span>
        <span class="title">{item.title}</span>
      </li>
    {:else}
      <li class="empty">No Final chapters. Mark chapters as Final in the sidebar.</li>
    {/each}
  </ul>
</div>

<style>
  .chapter-list-wrap {
    margin-bottom: 14px;
  }

  .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 4px;
  }

  .hint {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .chapter-list {
    list-style: none;
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--bg-surface);
    padding: 4px 0;
  }

  .chapter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 1px 10px;
    margin: 1px 6px;
    border-radius: var(--radius-sm);
    cursor: grab;
    touch-action: none;
    position: relative;
    z-index: 0;
  }

  .chapter-row:active {
    cursor: grabbing;
  }

  .chapter-row.dragging {
    opacity: 0.78;
    z-index: 2;
    background: var(--bg-elevated);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
  }

  .drag-handle {
    color: var(--text-muted);
    font-size: 10px;
    flex-shrink: 0;
    opacity: 0.35;
    pointer-events: none;
  }

  .chapter-row:hover .drag-handle {
    opacity: 0.9;
  }

  .order {
    font-size: 10px;
    color: var(--text-muted);
    width: 1.4em;
    flex-shrink: 0;
    text-align: right;
  }

  .title {
    flex: 1;
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .empty {
    font-size: 12px;
    color: var(--status-refine);
    padding: 12px;
    font-style: italic;
  }
</style>