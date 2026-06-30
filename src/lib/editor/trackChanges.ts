import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Fragment, type MarkType, type Node as PMNode, type Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { ReplaceStep, type Step } from "@tiptap/pm/transform";
import { isHistoryTransaction } from "prosemirror-history";

const TRACK_META = "trackChanges";
const trackStateByEditor = new WeakMap<Editor, boolean>();

export function setTrackChangesEnabled(editor: Editor | null, enabled: boolean) {
  if (editor) trackStateByEditor.set(editor, enabled);
}

export function isTrackChangesEnabled(editor: Editor): boolean {
  return trackStateByEditor.get(editor) ?? false;
}

function applyStepDoc(doc: PMNode, step: Step): PMNode {
  return step.apply(doc).doc ?? doc;
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
): Fragment {
  const out: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) {
      const marks = deletion
        .create({ markId })
        .addToSet(node.marks.filter((m) => m.type.name !== "deletion"));
      out.push(node.mark(marks));
    } else if (node.content.size) {
      out.push(node.copy(addDeletionMarks(node.content, deletion, markId)));
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
    tr.addMark(start, end, insertion.create({ markId }));
    modified = true;
  });
  return modified;
}

function reinsertDeletion(
  tr: Transaction,
  insertPos: number,
  deletedSlice: Slice,
  deletionType: MarkType,
): { tr: Transaction; insertPos: number } {
  const adjacentId = adjacentDeletionMarkId(tr.doc, insertPos, deletionType);
  const delMarkId = adjacentId ?? crypto.randomUUID();
  const marked = addDeletionMarks(deletedSlice.content, deletionType, delMarkId);
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

          for (const transaction of transactions) {
            if (!transaction.docChanged || !transaction.doc) continue;

            let stepDoc = curDoc;

            for (const step of transaction.steps) {
              if (!(step instanceof ReplaceStep)) {
                stepDoc = applyStepDoc(stepDoc, step);
                continue;
              }

              const delFrom = step.from;
              const delTo = step.to;

              // setContent / load HTML replaces the whole document — marks are already in the slice.
              if (delFrom === 0 && delTo === stepDoc.content.size) {
                stepDoc = applyStepDoc(stepDoc, step);
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
                  )
                ) {
                  hadInsertion = true;
                  modified = true;
                }
              }

              stepDoc = applyStepDoc(stepDoc, step);
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