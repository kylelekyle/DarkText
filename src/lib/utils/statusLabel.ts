import type { ChapterStatus } from "$lib/types";

/** Short status label for status bar and mind-map nodes. */
export function statusLabelShort(status: ChapterStatus): string {
  return status === "needs-refine" ? "Refine" : status;
}

/** Full status label for context menus. */
export function statusLabelFull(status: ChapterStatus): string {
  return status === "needs-refine" ? "Needs Refine" : status;
}

/** Badge label with capitalized draft/final. */
export function statusBadgeLabel(status: ChapterStatus): string {
  if (status === "needs-refine") return "Refine";
  return status.charAt(0).toUpperCase() + status.slice(1);
}