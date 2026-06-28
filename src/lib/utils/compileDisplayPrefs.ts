import type { LibraryPreferences } from "$lib/types";

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