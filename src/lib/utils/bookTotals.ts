import type { ChapterMeta, ChapterSection, ChapterStats } from "$lib/types";
import { computeBookTotals } from "$lib/utils/stats";

export function deriveBookTotals(
  chapters: ChapterMeta[],
  chapterStats: Record<string, ChapterStats>,
  activeChapterId: string | null,
  activeSection: ChapterSection,
  wordCount: number,
  charCount: number,
) {
  const active =
    activeChapterId && activeSection === "chapters"
      ? { chapterId: activeChapterId, words: wordCount, chars: charCount }
      : null;
  return computeBookTotals(chapters, chapterStats, active);
}