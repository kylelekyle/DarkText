// Combined from: mindmapFingerprint.ts, mindmapLayout.ts

import type { ChapterMeta, ChapterSection } from "$lib/types";

export function mindmapLibraryFingerprint(
  chapters: ChapterMeta[],
  research: ChapterMeta[],
  characters: ChapterMeta[],
): string {
  const part = (list: ChapterMeta[], tag: string) =>
    list.map((c) => `${tag}:${c.id}:${c.title}:${c.order}:${c.status}`).join("|");
  return [part(chapters, "c"), part(research, "r"), part(characters, "x")].join(";;");
}

export const NODE_W = 128;
export const NODE_H = 72;

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

function circlePos(
  index: number,
  total: number,
  cx: number,
  cy: number,
  radius: number,
): { x: number; y: number } {
  const count = Math.max(total, 1);
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle) - NODE_W / 2,
    y: cy + radius * Math.sin(angle) - NODE_H / 2,
  };
}

export function defaultNodePosition(
  index: number,
  section: ChapterSection,
  chapterCount: number,
  researchCount: number,
  characterCount = 0,
): { x: number; y: number } {
  const cx = 520;
  const cy = 380;
  if (section === "chapters") {
    const radius = Math.max(160, chapterCount * 28);
    return circlePos(index, chapterCount, cx - 120, cy, radius);
  }
  if (section === "research") {
    const radius = Math.max(200, researchCount * 32);
    return circlePos(index, researchCount, cx + 140, cy - 90, radius);
  }
  const radius = Math.max(180, characterCount * 32);
  return circlePos(index, characterCount, cx + 140, cy + 110, radius);
}

export function nodeCenter(x: number, y: number): { cx: number; cy: number } {
  return { cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
}

export function linkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const curve = Math.min(40, dist * 0.15);
  const nx = (-dy / dist) * curve;
  const ny = (dx / dist) * curve;
  return `M ${x1} ${y1} Q ${mx + nx} ${my + ny} ${x2} ${y2}`;
}