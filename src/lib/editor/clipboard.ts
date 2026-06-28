import type { Editor } from "@tiptap/core";

async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function readClipboardText(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

export async function cutSelection(editor: Editor | null): Promise<void> {
  if (!editor) return;
  const { empty, from, to } = editor.state.selection;
  if (empty) return;
  const text = editor.state.doc.textBetween(from, to);
  if (await writeClipboardText(text)) {
    editor.chain().focus().deleteSelection().run();
    return;
  }
  document.execCommand("cut");
}

export async function copySelection(editor: Editor | null): Promise<void> {
  if (!editor) return;
  const { empty, from, to } = editor.state.selection;
  if (empty) return;
  const text = editor.state.doc.textBetween(from, to);
  if (await writeClipboardText(text)) return;
  document.execCommand("copy");
}

export async function pasteIntoEditor(editor: Editor | null): Promise<void> {
  if (!editor) return;
  const text = await readClipboardText();
  if (text !== null) {
    editor.chain().focus().insertContent(text).run();
    return;
  }
  document.execCommand("paste");
}