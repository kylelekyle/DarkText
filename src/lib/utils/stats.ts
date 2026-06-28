import type { ChapterMeta, ChapterStats } from "$lib/types";
import { countWords } from "./wordCount";

export const WORDS_PER_PAGE = 250;

/** Mirrors Rust compile::html_to_text for consistent word/char counts. */
export function htmlToPlain(html: string): string {
  let out = "";
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) out += ch;
  }
  return out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function statsFromHtml(html: string): ChapterStats {
  const plain = htmlToPlain(html);
  return {
    words: countWords(plain),
    chars: plain.length,
  };
}

export function estimatePages(words: number): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_PAGE));
}

export function formatCompact(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function goalProgress(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

export function statsFromMeta(chapter: ChapterMeta): ChapterStats {
  return {
    words: chapter.wordCount ?? 0,
    chars: chapter.charCount ?? 0,
  };
}

export interface ActiveChapterStats {
  chapterId: string;
  words: number;
  chars: number;
}

export function computeBookTotals(
  chapters: ChapterMeta[],
  chapterStats: Record<string, ChapterStats>,
  active: ActiveChapterStats | null = null,
): { words: number; chars: number; pages: number } {
  let words = 0;
  let chars = 0;
  for (const ch of chapters) {
    if (active?.chapterId === ch.id) {
      words += active.words;
      chars += active.chars;
    } else {
      words += chapterStats[ch.id]?.words ?? ch.wordCount ?? 0;
      chars += chapterStats[ch.id]?.chars ?? ch.charCount ?? 0;
    }
  }
  return { words, chars, pages: estimatePages(words) };
}

export function loadChapterStats(
  chapters: ChapterMeta[],
  skipId?: string,
): Record<string, ChapterStats> {
  const stats: Record<string, ChapterStats> = {};
  for (const chapter of chapters) {
    if (chapter.id === skipId) continue;
    stats[chapter.id] = statsFromMeta(chapter);
  }
  return stats;
}