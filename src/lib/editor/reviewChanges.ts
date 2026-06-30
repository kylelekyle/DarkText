import type { TrackedChange } from "$lib/types";

/** True when live tracked-change metadata differs from the previous sidecar snapshot. */
export function trackedChangesDiffer(
  prev: TrackedChange[],
  next: TrackedChange[],
): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.markId !== b.markId ||
      a.type !== b.type ||
      a.text !== b.text ||
      a.status !== b.status ||
      a.author !== b.author
    ) {
      return true;
    }
  }
  return false;
}