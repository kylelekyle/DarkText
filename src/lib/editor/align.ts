import type { Editor } from "@tiptap/core";
import type { Node as ProseNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

export type TextAlignment = "left" | "center" | "right" | "justify";

const ALIGN_BLOCK_TYPES = new Set(["paragraph", "heading"]);

function alignParagraph(
  tr: Transaction,
  pos: number,
  node: ProseNode,
  alignment: TextAlignment,
) {
  const attrs =
    alignment === "left"
      ? { ...node.attrs, textAlign: null }
      : { ...node.attrs, textAlign: alignment };
  tr.setNodeMarkup(pos, undefined, attrs);
}

/** Apply alignment only to paragraph(s) in the current selection. */
export function setParagraphAlignment(
  editor: Editor,
  alignment: TextAlignment,
): boolean {
  const { state } = editor;
  const { selection } = state;
  const { from, to } = selection;
  const tr = state.tr;
  let updated = false;

  if (selection.empty) {
    const $from = selection.$from;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (ALIGN_BLOCK_TYPES.has(node.type.name)) {
        alignParagraph(tr, $from.before(d), node, alignment);
        updated = true;
        break;
      }
    }
  } else {
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (ALIGN_BLOCK_TYPES.has(node.type.name)) {
        alignParagraph(tr, pos, node, alignment);
        updated = true;
      }
    });
  }

  if (updated) {
    editor.view.dispatch(tr);
    editor.commands.focus();
    return true;
  }
  return false;
}