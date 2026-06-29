// Combined from: sidebarSelectionClick.ts, sidebarSelectionClear.ts

import type { ChapterMeta } from "$lib/types";
import type { SidebarSelectionStore } from "$lib/stores/sidebarSelection.svelte";
import { sidebarSelection } from "$lib/stores/sidebarSelection.svelte";

export interface SidebarClickResult {
  open: boolean;
  chapterId: string;
}

/** Standard ctrl/shift click selection; plain click selects one and opens. */
export function handleSidebarChapterClick(
  e: MouseEvent,
  chapterId: string,
  items: ChapterMeta[],
  selection: SidebarSelectionStore,
): SidebarClickResult {
  const additive = e.ctrlKey || e.metaKey;

  if (e.shiftKey && selection.anchorId) {
    selection.setRange(items, selection.anchorId, chapterId, additive);
    return { open: false, chapterId };
  }

  if (additive) {
    selection.toggle(chapterId);
    return { open: false, chapterId };
  }

  selection.anchorId = chapterId;
  selection.selectedIds = new Set();
  return { open: true, chapterId };
}

/** Clear multi-select when the user clicks outside sidebar chapter rows. */
export function clearSidebarSelectionOnOutsideClick(e: MouseEvent): void {
  if (!sidebarSelection.hasSelection) return;

  const target = e.target as HTMLElement | null;
  if (target?.closest(".context-menu")) return;
  if (target?.closest(".sidebar .item-list .list-item")) return;

  sidebarSelection.clear();
}