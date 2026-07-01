/** Data-mapping helpers shared by the graph view and its persistence layer. */

import type { ChapterMeta, ChapterSection } from "$lib/types";

/** Cheap change-detection key for the library data the graph is built from. */
export function mindmapLibraryFingerprint(
  chapters: ChapterMeta[],
  research: ChapterMeta[],
  characters: ChapterMeta[],
): string {
  const part = (list: ChapterMeta[], tag: string) =>
    list.map((c) => `${tag}:${c.id}:${c.title}:${c.order}:${c.status}`).join("|");
  return [part(chapters, "c"), part(research, "r"), part(characters, "x")].join(";;");
}

export function nodeKey(section: ChapterSection, id: string): string {
  return `${section}:${id}`;
}

export function parseNodeKey(key: string): { section: ChapterSection; id: string } | null {
  const idx = key.indexOf(":");
  if (idx < 1) return null;
  const section = key.slice(0, idx) as ChapterSection;
  if (section !== "chapters" && section !== "research" && section !== "characters") return null;
  return { section, id: key.slice(idx + 1) };
}
