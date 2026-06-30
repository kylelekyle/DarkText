import { chapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import type { ChapterMeta, ChapterSection } from "$lib/types";

function listForSection(section: ChapterSection): ChapterMeta[] {
  if (section === "research") return libraryStore.researchChapters;
  if (section === "characters") return libraryStore.characterChapters;
  return libraryStore.library?.chapters ?? [];
}

/** Pick a different chapter to show in the secondary pane when split view opens. */
export function pickDefaultSplitChapter(): {
  chapterId: string;
  section: ChapterSection;
} | null {
  const section = chapterStore.activeSection;
  const primaryId = chapterStore.activeChapterId;
  const items = listForSection(section);
  const candidate = items.find((c) => c.id !== primaryId);
  if (!candidate) return null;
  return { chapterId: candidate.id, section };
}