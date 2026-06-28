import type { ChapterMeta } from "$lib/types";

/** Apply a new Final-chapter order into the full library chapter list. */
export function mergeFinalChapterOrder(
  full: ChapterMeta[],
  finals: ChapterMeta[],
  reorderedFinalIds: string[],
): ChapterMeta[] | null {
  if (full.length === 0 || reorderedFinalIds.length === 0) return null;

  const finalById = new Map(finals.map((c) => [c.id, c]));
  const reorderedFinals = reorderedFinalIds
    .map((id) => finalById.get(id))
    .filter((c): c is ChapterMeta => !!c);
  if (reorderedFinals.length !== finals.length) return null;

  const result = [...full];
  const finalIndices: number[] = [];
  full.forEach((ch, i) => {
    if (ch.status === "final") finalIndices.push(i);
  });
  finalIndices.forEach((idx, i) => {
    result[idx] = reorderedFinals[i];
  });
  return result;
}