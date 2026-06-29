// Combined from: statusLabel.ts, sectionLabels.ts, menuPosition.ts

import type { ChapterSection, ChapterStatus } from "$lib/types";

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

function sectionNoun(section: ChapterSection): string {
  switch (section) {
    case "chapters":
      return "Chapter";
    case "research":
      return "Research";
    case "characters":
      return "Character";
  }
}

export function sectionItemLabel(
  section: ChapterSection,
  action: "new" | "rename" | "duplicate" | "delete" | "snapshots",
): string {
  const noun = sectionNoun(section);
  switch (action) {
    case "new":
      return `New ${noun}`;
    case "rename":
      return `Rename ${noun}…`;
    case "duplicate":
      return `Duplicate ${noun}`;
    case "delete":
      return `Delete ${noun}`;
    case "snapshots":
      return `${noun} snapshots…`;
  }
}

/** Keep context menus within the viewport. */
export function clampMenuPosition(
  x: number,
  y: number,
  menuW = 200,
  menuH = 280,
): { x: number; y: number } {
  const pad = 8;
  const maxX = window.innerWidth - menuW - pad;
  const maxY = window.innerHeight - menuH - pad;
  return {
    x: Math.max(pad, Math.min(x, maxX)),
    y: Math.max(pad, Math.min(y, maxY)),
  };
}