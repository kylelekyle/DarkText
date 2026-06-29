// Combined from: compileDisplayPrefs.ts, compileChapterReorder.ts

import type { ChapterMeta, LibraryPreferences } from "$lib/types";

export function compileShowChapterNumbers(prefs?: LibraryPreferences): boolean {
  return prefs?.compileShowChapterNumbers !== false;
}

export function compileShowChapterTitles(prefs?: LibraryPreferences): boolean {
  return prefs?.compileShowChapterTitles !== false;
}

/** Heading for a compiled chapter (1-based order in the Final list). */
export function compileChapterHeading(
  order: number,
  title: string,
  prefs?: LibraryPreferences,
): string | undefined {
  const showNumbers = compileShowChapterNumbers(prefs);
  const showTitles = compileShowChapterTitles(prefs);
  const number = showNumbers ? `Chapter ${order}` : undefined;
  const name = showTitles && title.trim() ? title.trim() : undefined;
  if (number && name) return `${number} — ${name}`;
  if (number) return number;
  if (name) return name;
  return undefined;
}

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