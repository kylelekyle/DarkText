import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Move caret to the end of the document and focus the editor. */
export function focusEditorAtEnd(editor: Editor) {
  const { doc } = editor.state;
  const end = doc.content.size;
  const $pos = doc.resolve(Math.max(0, end - 1));
  const selection = TextSelection.near($pos, -1);
  editor.view.dispatch(editor.state.tr.setSelection(selection));
  editor.view.focus();
}

function isBelowLastBlock(view: EditorView, clientY: number): boolean {
  const dom = view.dom;
  const blocks = dom.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote");
  const last = blocks[blocks.length - 1] as HTMLElement | undefined;
  if (!last) return false;
  return clientY > last.getBoundingClientRect().bottom + 2;
}

/** Place the caret when a click lands in empty chrome below the text. */
export function handleEditorMousedown(
  view: EditorView,
  event: MouseEvent,
): boolean {
  if (!isBelowLastBlock(view, event.clientY)) return false;

  const { doc } = view.state;
  const end = doc.content.size;
  const $pos = doc.resolve(Math.max(0, end - 1));
  const selection = TextSelection.near($pos, -1);
  view.dispatch(view.state.tr.setSelection(selection));
  view.focus();
  return true;
}