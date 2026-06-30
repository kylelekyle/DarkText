import type { Editor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";

/** Collapse clipboard newlines so paste stays in the current paragraph. */
export function collapsePasteText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n+/g, " ");
}

/** Strip block structure from clipboard HTML; keep a single inline string. */
export function htmlToInlinePasteText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const blocks = [...doc.body.querySelectorAll("p, h1, h2, h3, h4, li, div")];
  if (blocks.length > 0) {
    return collapsePasteText(
      blocks.map((el) => el.textContent ?? "").join(" "),
    );
  }
  return collapsePasteText(doc.body.textContent ?? "");
}

/** True when the caret sits in body prose (paste should not split the paragraph). */
export function shouldPasteInline(view: EditorView): boolean {
  const { $from } = view.state.selection;
  if (!$from.parent.isTextblock) return false;
  const name = $from.parent.type.name;
  return name === "paragraph" || name === "heading";
}

/** Insert pasted characters inline — never creates new block nodes. */
export function insertInlinePaste(editor: Editor, raw: string): boolean {
  const text = collapsePasteText(raw);
  if (!text) return false;
  return editor
    .chain()
    .focus()
    .command(({ tr, state, dispatch }) => {
      const { from, to } = state.selection;
      tr.insertText(text, from, to);
      if (dispatch) dispatch(tr);
      return true;
    })
    .run();
}