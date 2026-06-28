import type { ChapterMeta } from "$lib/types";
import type { SidebarSelectionStore } from "$lib/stores/sidebarSelection.svelte";

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