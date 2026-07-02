import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Fragment, type MarkType, type Node as PMNode, type Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { isHistoryTransaction } from "prosemirror-history";
import type { TrackedChange } from "$lib/types";

const TRACK_META = "trackChanges";
const trackStateByEditor = new WeakMap<Editor, boolean>();
const authorByEditor = new WeakMap<Editor, string>();

export function setTrackChangesEnabled(editor: Editor | null, enabled: boolean) {
  if (editor) trackStateByEditor.set(editor, enabled);
}

export function isTrackChangesEnabled(editor: Editor): boolean {
  return trackStateByEditor.get(editor) ?? false;
}

/** Name attributed to tracked changes this editor produces (Word-style author). */
export function setReviewAuthor(editor: Editor | null, author: string) {
  if (editor) authorByEditor.set(editor, author);
}

function reviewAuthor(editor: Editor): string | null {
  return authorByEditor.get(editor) ?? null;
}

/** Build the attribute set for a change mark, omitting a null author. */
function changeAttrs(markId: string, author: string | null): Record<string, unknown> {
  return author ? { markId, author } : { markId };
}

function sliceHasNonDeletionText(slice: Slice, deletion: MarkType): boolean {
  let found = false;
  slice.content.descendants((node) => {
    if (!node.isText) return;
    if (!node.marks.some((m) => m.type === deletion)) found = true;
  });
  return found;
}

function addDeletionMarks(
  fragment: Fragment,
  deletion: MarkType,
  markId: string,
  author: string | null,
): Fragment {
  const out: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) {
      const marks = deletion
        .create(changeAttrs(markId, author))
        .addToSet(node.marks.filter((m) => m.type.name !== "deletion"));
      out.push(node.mark(marks));
    } else if (node.content.size) {
      out.push(node.copy(addDeletionMarks(node.content, deletion, markId, author)));
    } else {
      out.push(node);
    }
  });
  return Fragment.fromArray(out);
}

/** Reuse an adjacent deletion mark when extending a backspace/delete region. */
function adjacentDeletionMarkId(
  doc: PMNode,
  pos: number,
  deletion: MarkType,
): string | null {
  const $pos = doc.resolve(pos);
  const before = $pos.nodeBefore;
  if (before?.isText) {
    const mark = before.marks.find((m) => m.type === deletion);
    const id = mark?.attrs.markId as string | null | undefined;
    if (id) return id;
  }
  const after = $pos.nodeAfter;
  if (after?.isText) {
    const mark = after.marks.find((m) => m.type === deletion);
    const id = mark?.attrs.markId as string | null | undefined;
    if (id) return id;
  }
  return null;
}

function stripDeletionMarks(
  tr: Transaction,
  from: number,
  to: number,
  deletion: MarkType,
): void {
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    if (!node.marks.some((m) => m.type === deletion)) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    if (end > start) tr.removeMark(start, end, deletion);
  });
}

function markInsertionRange(
  tr: Transaction,
  from: number,
  to: number,
  insertion: MarkType,
  deletion: MarkType,
  markId: string,
  author: string | null,
): boolean {
  if (to <= from) return false;
  stripDeletionMarks(tr, from, to, deletion);
  let modified = false;
  tr.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type === deletion)) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    if (end <= start) return;
    tr.addMark(start, end, insertion.create(changeAttrs(markId, author)));
    modified = true;
  });
  return modified;
}

function reinsertDeletion(
  tr: Transaction,
  insertPos: number,
  deletedSlice: Slice,
  deletionType: MarkType,
  author: string | null,
): { tr: Transaction; insertPos: number } {
  const adjacentId = adjacentDeletionMarkId(tr.doc, insertPos, deletionType);
  const delMarkId = adjacentId ?? crypto.randomUUID();
  const marked = addDeletionMarks(
    deletedSlice.content,
    deletionType,
    delMarkId,
    author,
  );
  return { tr: tr.insert(insertPos, marked), insertPos };
}

/** Skip left over struck-through text so backspace edits live prose. */
function liveTextPosBeforeDeletions(doc: PMNode, pos: number): number | null {
  let cur = pos;
  while (cur > 0) {
    const $r = doc.resolve(cur);
    const before = $r.nodeBefore;
    if (!before?.isText) break;
    if (!before.marks.some((m) => m.type.name === "deletion")) return cur;
    cur -= before.nodeSize;
  }
  return cur > 0 ? cur : null;
}

export const TrackChangesPlugin = Extension.create({
  name: "trackChangesPlugin",

  addProseMirrorPlugins() {
    const editor = this.editor;
    const insertionType = editor.schema.marks.insertion;
    const deletionType = editor.schema.marks.deletion;
    if (!insertionType || !deletionType) return [];

    return [
      new Plugin({
        key: new PluginKey("trackChangesKeys"),
        props: {
          handleKeyDown(view, event) {
            if (!isTrackChangesEnabled(editor)) return false;
            if (event.key !== "Backspace" || !view.state.selection.empty) return false;

            const { $from } = view.state.selection;
            const nodeBefore = $from.nodeBefore;
            if (
              !nodeBefore?.isText ||
              !nodeBefore.marks.some((m) => m.type.name === "deletion")
            ) {
              return false;
            }

            const livePos = liveTextPosBeforeDeletions(view.state.doc, $from.pos);
            if (livePos === null || livePos === $from.pos) return false;

            view.dispatch(
              view.state.tr.setSelection(
                TextSelection.create(view.state.doc, livePos),
              ),
            );
            return true;
          },
        },
      }),
      new Plugin({
        key: new PluginKey("trackChanges"),
        appendTransaction(transactions, oldState, newState) {
          if (!isTrackChangesEnabled(editor)) return null;
          if (transactions.some((t) => t.getMeta(TRACK_META))) return null;
          if (transactions.some((t) => isHistoryTransaction(t))) return null;
          if (!transactions.some((t) => t.docChanged)) return null;

          let tr = newState.tr;
          let modified = false;
          let curDoc = oldState.doc;
          let cursorBeforeDeletion: number | null = null;
          let hadInsertion = false;
          const author = reviewAuthor(editor);

          for (const transaction of transactions) {
            if (!transaction.docChanged || !transaction.doc) continue;

            let stepDoc = curDoc;

            for (const step of transaction.steps) {
              if (!(step instanceof ReplaceStep)) {
                stepDoc = step.apply(stepDoc).doc ?? stepDoc;
                continue;
              }

              const delFrom = step.from;
              const delTo = step.to;

              // setContent / load HTML replaces the whole document — marks are already in the slice.
              if (delFrom === 0 && delTo === stepDoc.content.size) {
                stepDoc = step.apply(stepDoc).doc ?? stepDoc;
                continue;
              }

              const deletedSlice = stepDoc.slice(delFrom, delTo);

              if (sliceHasNonDeletionText(deletedSlice, deletionType)) {
                const insertPos = tr.mapping.map(delFrom, -1);
                const result = reinsertDeletion(
                  tr,
                  insertPos,
                  deletedSlice,
                  deletionType,
                  author,
                );
                tr = result.tr;
                cursorBeforeDeletion =
                  cursorBeforeDeletion === null
                    ? result.insertPos
                    : Math.min(cursorBeforeDeletion, result.insertPos);
                modified = true;
              }

              if (step.slice.size > 0) {
                const insMarkId = crypto.randomUUID();
                const from = tr.mapping.map(delFrom, 1);
                const to = tr.mapping.map(delFrom + step.slice.size, -1);
                if (
                  markInsertionRange(
                    tr,
                    from,
                    to,
                    insertionType,
                    deletionType,
                    insMarkId,
                    author,
                  )
                ) {
                  hadInsertion = true;
                  modified = true;
                }
              }

              stepDoc = step.apply(stepDoc).doc ?? stepDoc;
            }

            curDoc = transaction.doc;
          }

          if (modified && cursorBeforeDeletion !== null && !hadInsertion) {
            const pos = Math.min(cursorBeforeDeletion, tr.doc.content.size);
            tr = tr.setSelection(TextSelection.create(tr.doc, pos));
          }

          return modified ? tr.setMeta(TRACK_META, true) : null;
        },
      }),
    ];
  },
});
/** True when live tracked-change metadata differs from the previous sidecar snapshot. */
export function trackedChangesDiffer(
  prev: TrackedChange[],
  next: TrackedChange[],
): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.markId !== b.markId ||
      a.type !== b.type ||
      a.text !== b.text ||
      a.status !== b.status ||
      a.author !== b.author
    ) {
      return true;
    }
  }
  return false;
}
