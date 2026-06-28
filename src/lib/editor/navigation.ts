import type { Editor } from "@tiptap/core";

export function scrollToMarkId(
  editor: Editor,
  markId: string,
  markNames: string[],
): boolean {
  let target: number | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (target !== null || !node.isText) return;
    for (const mark of node.marks) {
      if (mark.attrs.markId === markId && markNames.includes(mark.type.name)) {
        target = pos;
        return false;
      }
    }
  });

  if (target === null) return false;

  const ok = editor
    .chain()
    .focus()
    .setTextSelection(target)
    .scrollIntoView()
    .run();

  if (ok && typeof document !== "undefined") {
    const el = editor.view.domAtPos(target).node as HTMLElement;
    const targetEl =
      el.nodeType === Node.TEXT_NODE
        ? (el.parentElement ?? editor.view.dom)
        : el;
    targetEl.classList.add("dt-jump-flash");
    window.setTimeout(() => targetEl.classList.remove("dt-jump-flash"), 1400);
  }

  return ok;
}

export function scrollToComment(editor: Editor, markId: string): boolean {
  return scrollToMarkId(editor, markId, ["comment"]);
}

export function scrollToChange(editor: Editor, markId: string): boolean {
  return scrollToMarkId(editor, markId, ["insertion", "deletion"]);
}

function flashAtPosition(editor: Editor, pos: number): void {
  if (typeof document === "undefined") return;
  const el = editor.view.domAtPos(pos).node as HTMLElement;
  const targetEl =
    el.nodeType === Node.TEXT_NODE
      ? (el.parentElement ?? editor.view.dom)
      : el;
  targetEl.classList.add("dt-jump-flash");
  window.setTimeout(() => targetEl.classList.remove("dt-jump-flash"), 1400);
}

type TextMatch = { from: number; to: number; dist: number };

function findTextQueryMatch(
  editor: Editor,
  query: string,
  matchIndex?: number,
): TextMatch | null {
  const q = query.trim();
  if (!q) return null;
  const lowerQ = q.toLowerCase();

  const matches: TextMatch[] = [];
  let plain = 0;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (node.marks.some((m) => m.type.name === "deletion")) return;
    const text = node.text;
    const lower = text.toLowerCase();
    let i = 0;
    while (i < lower.length) {
      const idx = lower.indexOf(lowerQ, i);
      if (idx < 0) break;
      const from = pos + idx;
      const to = from + q.length;
      const startPlain = plain + idx;
      matches.push({ from, to, dist: startPlain });
      i = idx + 1;
    }
    plain += text.length;
  });

  if (matches.length === 0) return null;
  if (matchIndex === undefined) return matches[0];

  let best = matches[0];
  let bestDist = Math.abs(best.dist - matchIndex);
  for (const m of matches) {
    const d = Math.abs(m.dist - matchIndex);
    if (d < bestDist) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}

/** Scroll to a plain-text query match; optional matchIndex picks closest occurrence. */
export function scrollToTextQuery(
  editor: Editor,
  query: string,
  matchIndex?: number,
): boolean {
  let target = findTextQueryMatch(editor, query, matchIndex);
  if (!target && matchIndex !== undefined) {
    target = findTextQueryMatch(editor, query, undefined);
  }
  if (!target) return false;

  const ok = editor
    .chain()
    .focus()
    .setTextSelection({ from: target.from, to: target.to })
    .scrollIntoView()
    .run();

  if (ok) flashAtPosition(editor, target.from);
  return ok;
}