import type { Editor } from "@tiptap/core";
import { setTrackChangesEnabled } from "$lib/editor/trackChanges";
import { reviewStore } from "$lib/stores/review.svelte";

const TRACK_META = "trackChanges";

function ensureReviewTracking(editor: Editor | null): void {
  if (!editor || reviewStore.trackChanges) return;
  reviewStore.trackChanges = true;
  setTrackChangesEnabled(editor, true);
}

export function toggleBold(editor: Editor | null): void {
  editor?.chain().focus().toggleBold().run();
}

export function toggleItalic(editor: Editor | null): void {
  editor?.chain().focus().toggleItalic().run();
}

export function toggleUnderline(editor: Editor | null): void {
  editor?.chain().focus().toggleUnderline().run();
}

export function toggleStrike(editor: Editor | null): void {
  editor?.chain().focus().toggleStrike().run();
}

function selectionTouchesDeletion(editor: Editor, from: number, to: number): boolean {
  if (from === to) return editor.isActive("deletion");
  let found = false;
  editor.state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return;
    if (node.marks.some((m) => m.type.name === "deletion")) found = true;
  });
  return found;
}

export function isDeletionMarkActive(editor: Editor | null): boolean {
  return !!editor && !editor.isDestroyed && editor.isActive("deletion");
}

/** Author: plain strikethrough. Review: tracked deletion mark. */
export function toggleStrikethrough(editor: Editor | null, reviewMode: boolean): void {
  if (reviewMode) {
    ensureReviewTracking(editor);
    toggleTrackedDeletionMark(editor);
  } else {
    toggleStrike(editor);
  }
}

export function isStrikethroughActive(editor: Editor | null, reviewMode: boolean): boolean {
  if (!editor || editor.isDestroyed) return false;
  return reviewMode ? editor.isActive("deletion") : editor.isActive("strike");
}

/** Review-mode strikethrough — applies dt-deletion marks, not plain <s>. */
export function toggleTrackedDeletionMark(editor: Editor | null): void {
  if (!editor) return;
  const deletion = editor.schema.marks.deletion;
  if (!deletion) return;

  const { from, to, empty } = editor.state.selection;

  if (empty) {
    if (!editor.isActive("deletion")) return;
    editor
      .chain()
      .focus()
      .extendMarkRange("deletion")
      .command(({ tr, state, dispatch }) => {
        const sel = state.selection;
        tr.removeMark(sel.from, sel.to, deletion);
        if (dispatch) dispatch(tr.setMeta(TRACK_META, true));
        return true;
      })
      .run();
    return;
  }

  const removing = selectionTouchesDeletion(editor, from, to);

  editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (removing) {
        tr.removeMark(from, to, deletion);
      } else {
        tr.addMark(from, to, deletion.create({ markId: crypto.randomUUID() }));
      }
      if (dispatch) dispatch(tr.setMeta(TRACK_META, true));
      return true;
    })
    .run();
}

export function undoEditor(editor: Editor | null): void {
  editor?.chain().focus().undo().run();
}

export function redoEditor(editor: Editor | null): void {
  editor?.chain().focus().redo().run();
}