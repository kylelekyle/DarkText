import { sidebarSelection } from "$lib/stores/sidebarSelection.svelte";

/** Clear multi-select when the user clicks outside sidebar chapter rows. */
export function clearSidebarSelectionOnOutsideClick(e: MouseEvent): void {
  if (!sidebarSelection.hasSelection) return;

  const target = e.target as HTMLElement | null;
  if (target?.closest(".context-menu")) return;
  if (target?.closest(".sidebar .item-list .list-item")) return;

  sidebarSelection.clear();
}