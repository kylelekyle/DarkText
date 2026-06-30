/** Stable per-author colors for tracked-change markup (Word-style attribution). */

/** Dark-theme-friendly, visually distinct hues. */
export const REVIEW_AUTHOR_PALETTE = [
  "#5b9dd6", // blue
  "#c45c5c", // red
  "#4a9e72", // green
  "#c9a227", // amber
  "#a87fd0", // violet
  "#d07f4a", // orange
  "#48a9a6", // teal
  "#cf6a98", // pink
] as const;

/** Fallback when a change has no recorded author (legacy sidecars). */
export const REVIEW_UNKNOWN_COLOR = "#8a8f98";

/** Deterministic small hash so an author always maps to the same hue. */
function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorForAuthor(author: string | null | undefined): string {
  const name = author?.trim();
  if (!name) return REVIEW_UNKNOWN_COLOR;
  return REVIEW_AUTHOR_PALETTE[hashString(name) % REVIEW_AUTHOR_PALETTE.length];
}
