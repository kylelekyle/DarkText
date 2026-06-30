import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Fragment, type MarkType, type Node as PMNode, type Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { ChangeSet } from "@tiptap/pm/changeset";

const TRACK_META = "trackChanges";
const trackStateByEditor = new WeakMap<Editor, boolean>();

export function setTrackChangesEnabled(editor: Editor | null, enabled: boolean) {
  if (editor) trackStateByEditor.set(editor, enabled);
}

export function isTrackChangesEnabled(editor: Editor): boolean {
  return trackStateByEditor.get(editor) ?? false;
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

function markInsertionRange(
  tr: Transaction,
  from: number,
  to: number,
  insertion: MarkType,
  deletion: MarkType,
  markId: string,
): boolean {
  if (to <= from) return false;
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

export const TrackChangesPlugin = Extension.create({
  name: "trackChangesPlugin",

  addProseMirrorPlugins() {
    const editor = this.editor;
    const insertionType = editor.schema.marks.insertion;
    const deletionType = editor.schema.marks.deletion;
    if (!insertionType || !deletionType) return [];

    return [
      new Plugin({
        key: new PluginKey("trackChanges"),
        appendTransaction(transactions, oldState, newState) {
          if (!isTrackChangesEnabled(editor)) return null;
          if (transactions.some((t) => t.getMeta(TRACK_META))) return null;
          if (!transactions.some((t) => t.docChanged)) return null;

          let tr = newState.tr;
          let modified = false;
          let curDoc = oldState.doc;
          let cursorBeforeDeletion: number | null = null;

          for (const transaction of transactions) {
            if (!transaction.docChanged || !transaction.doc) continue;

            const beforeDoc = curDoc;
            const maps = transaction.steps.map((s) => s.getMap());
            const changeSet = ChangeSet.create(beforeDoc).addSteps(
              transaction.doc,
              maps,
              null,
            );
            curDoc = transaction.doc;

            if (changeSet.changes.length === 0) continue;

            const deletions = [...changeSet.changes]
              .filter((c) => c.toA > c.fromA)
              .sort((a, b) => b.fromB - a.fromB);

            for (const change of deletions) {
              const deletedSlice = beforeDoc.slice(change.fromA, change.toA);
              if (!sliceHasNonDeletionText(deletedSlice, deletionType)) continue;
              const insertPos = tr.mapping.map(change.fromB, -1);
              const adjacentId = adjacentDeletionMarkId(
                tr.doc,
                insertPos,
                deletionType,
              );
              const delMarkId = adjacentId ?? crypto.randomUUID();
              const marked = addDeletionMarks(
                deletedSlice.content,
                deletionType,
                delMarkId,
              );
              tr = tr.insert(insertPos, marked);
              cursorBeforeDeletion =
                cursorBeforeDeletion === null
                  ? insertPos
                  : Math.min(cursorBeforeDeletion, insertPos);
              modified = true;
            }

            for (const change of changeSet.changes) {
              if (change.toB <= change.fromB) continue;
              const from = tr.mapping.map(change.fromB, 1);
              const to = tr.mapping.map(change.toB, -1);
              if (to <= from) continue;
              const insMarkId = crypto.randomUUID();
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
                modified = true;
              }
            }
          }

          if (modified && cursorBeforeDeletion !== null) {
            const $pos = tr.doc.resolve(
              Math.min(cursorBeforeDeletion, tr.doc.content.size),
            );
            tr = tr.setSelection(TextSelection.near($pos, -1));
          }

          return modified ? tr.setMeta(TRACK_META, true) : null;
        },
      }),
    ];
  },
});