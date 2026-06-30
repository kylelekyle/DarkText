import type { Editor } from "@tiptap/core";
import type { TrackedChange } from "$lib/types";

const TRACK_META = "trackChanges";

/** Collect comment markIds still present in the live document. */
export function collectCommentMarkIdsFromEditor(editor: Editor): Set<string> {
  const ids = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "comment") continue;
      const markId = mark.attrs.markId as string | null | undefined;
      if (markId) ids.add(markId);
    }
  });
  return ids;
}

interface MarkInfo {
  type: "insertion" | "deletion";
  text: string;
  author: string | null;
}

function collectMarkTexts(editor: Editor): Map<string, MarkInfo> {
  const parts = new Map<string, string[]>();
  const types = new Map<string, "insertion" | "deletion">();
  const authors = new Map<string, string | null>();

  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "insertion" && mark.type.name !== "deletion") continue;
      const markId = mark.attrs.markId as string | null | undefined;
      if (!markId) continue;
      types.set(markId, mark.type.name === "deletion" ? "deletion" : "insertion");
      const author = mark.attrs.author as string | null | undefined;
      if (author && !authors.get(markId)) authors.set(markId, author);
      const bucket = parts.get(markId) ?? [];
      if (node.text) bucket.push(node.text);
      parts.set(markId, bucket);
    }
  });

  const result = new Map<string, MarkInfo>();
  for (const [markId, chunks] of parts) {
    const type = types.get(markId);
    if (!type) continue;
    result.set(markId, {
      type,
      text: chunks.join("").slice(0, 80),
      author: authors.get(markId) ?? null,
    });
  }
  return result;
}

/** Preferred: walk the live ProseMirror document (no DOMParser round-trip). */
export function syncChangesFromEditor(
  editor: Editor,
  existing: TrackedChange[],
): TrackedChange[] {
  const existingMap = new Map(existing.map((c) => [c.markId, c]));
  const live = collectMarkTexts(editor);
  const result: TrackedChange[] = [];

  for (const [markId, { type, text, author }] of live) {
    const prev = existingMap.get(markId);
    result.push(
      prev
        ? { ...prev, type, text, author: prev.author ?? author ?? undefined }
        : {
            id: markId,
            markId,
            type,
            text,
            status: "pending",
            createdAt: new Date().toISOString(),
            author: author ?? undefined,
          },
    );
  }

  return result;
}

/** Fallback when the editor instance is unavailable (tests, headless HTML). */
export function syncChangesFromHtml(
  html: string,
  existing: TrackedChange[],
): TrackedChange[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const existingMap = new Map(existing.map((c) => [c.markId, c]));
  const result: TrackedChange[] = [];

  for (const el of doc.querySelectorAll("[data-change-id]")) {
    const markId = el.getAttribute("data-change-id");
    if (!markId) continue;
    const type = el.classList.contains("dt-deletion") ? "deletion" : "insertion";
    const author = el.getAttribute("data-author");
    const prev = existingMap.get(markId);
    const text = el.textContent?.slice(0, 80) ?? "";
    result.push(
      prev ? { ...prev, type, text, author: prev.author ?? author ?? undefined } : {
        id: markId,
        markId,
        type,
        text,
        status: "pending",
        createdAt: new Date().toISOString(),
        author: author ?? undefined,
      },
    );
  }

  return result;
}

function mergeMarkRanges(
  ranges: { from: number; to: number }[],
): { from: number; to: number }[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.from <= prev.to) {
      prev.to = Math.max(prev.to, cur.to);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function applyChangeInEditor(
  editor: Editor,
  change: TrackedChange,
  action: "accept" | "reject",
): boolean {
  const insertion = editor.schema.marks.insertion;
  const deletion = editor.schema.marks.deletion;
  if (!insertion || !deletion) return false;

  const markName = change.type === "insertion" ? "insertion" : "deletion";

  return editor
    .chain()
    .command(({ tr, state, dispatch }) => {
      const ranges: { from: number; to: number }[] = [];

      state.doc.descendants((node, pos) => {
        if (!node.isText) return;
        for (const mark of node.marks) {
          if (mark.attrs.markId !== change.markId) continue;
          if (mark.type.name !== markName) continue;
          ranges.push({ from: pos, to: pos + node.nodeSize });
        }
      });

      const merged = mergeMarkRanges(ranges);
      if (merged.length === 0) return false;

      for (const { from, to } of [...merged].sort((a, b) => b.from - a.from)) {
        if (change.type === "insertion") {
          if (action === "accept") tr.removeMark(from, to, insertion);
          else tr.delete(from, to);
        } else {
          if (action === "accept") tr.delete(from, to);
          else tr.removeMark(from, to, deletion);
        }
      }

      if (dispatch) dispatch(tr.setMeta(TRACK_META, true));
      return true;
    })
    .run();
}