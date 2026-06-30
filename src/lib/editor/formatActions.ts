import type { Editor } from "@tiptap/core";

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

export function undoEditor(editor: Editor | null): void {
  editor?.chain().focus().undo().run();
}

export function redoEditor(editor: Editor | null): void {
  editor?.chain().focus().redo().run();
}