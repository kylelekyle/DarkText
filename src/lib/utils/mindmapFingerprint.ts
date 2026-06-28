import type { ChapterMeta } from "$lib/types";

export function mindmapLibraryFingerprint(
  chapters: ChapterMeta[],
  research: ChapterMeta[],
  characters: ChapterMeta[],
): string {
  const part = (list: ChapterMeta[], tag: string) =>
    list.map((c) => `${tag}:${c.id}:${c.title}:${c.order}:${c.status}`).join("|");
  return [part(chapters, "c"), part(research, "r"), part(characters, "x")].join(";;");
}