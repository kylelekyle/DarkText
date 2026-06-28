import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Fragment, type MarkType, type Node as PMNode, type Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
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
              const delMarkId = crypto.randomUUID();
              const marked = addDeletionMarks(
                deletedSlice.content,
                deletionType,
                delMarkId,
              );
              tr = tr.insert(insertPos, marked);
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

          return modified ? tr.setMeta(TRACK_META, true) : null;
        },
      }),
    ];
  },
});