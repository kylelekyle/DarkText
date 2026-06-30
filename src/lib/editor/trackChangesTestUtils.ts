import { Editor, type Editor as EditorType } from "@tiptap/core";
import { buildChapterExtensions } from "$lib/editor/chapterEditorSetup";
import { findInDocument } from "$lib/editor/search";
import { setTrackChangesEnabled } from "$lib/editor/trackChanges";

export function createTrackedEditor(content: string, track = true): EditorType {
  const editor = new Editor({
    extensions: buildChapterExtensions(null),
    content,
  });
  setTrackChangesEnabled(editor, track);
  return editor;
}

/** Visible story text (marks stripped by ProseMirror text serialization). */
export function editorPlainText(editor: EditorType): string {
  return editor.getText().replace(/\s+/g, " ").trim();
}

export function selectText(editor: EditorType, query: string): boolean {
  const match = findInDocument(editor, query, 0);
  if (!match) return false;
  editor.chain().focus().setTextSelection(match).run();
  return true;
}

export function countSubstring(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}