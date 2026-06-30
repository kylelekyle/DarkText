import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { colorForAuthor } from "$lib/utils/reviewColors";

/** First tracked-change author found inside a block, for the change-bar hue. */
function blockChangeAuthor(node: PMNode): { has: boolean; author: string | null } {
  let has = false;
  let author: string | null = null;
  node.descendants((child) => {
    if (!child.isText) return;
    for (const mark of child.marks) {
      if (mark.type.name === "insertion" || mark.type.name === "deletion") {
        has = true;
        if (!author) author = (mark.attrs.author as string | null) ?? null;
      }
    }
  });
  return { has, author };
}

/** Tag top-level blocks that contain tracked changes so CSS can draw a margin bar. */
function buildChangeBarDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.forEach((node, offset) => {
    if (!node.isBlock) return;
    const { has, author } = blockChangeAuthor(node);
    if (!has) return;
    decorations.push(
      Decoration.node(offset, offset + node.nodeSize, {
        class: "dt-change-block",
        style: `--rev-bar:${colorForAuthor(author)}`,
      }),
    );
  });
  return DecorationSet.create(doc, decorations);
}

const changeBarKey = new PluginKey("reviewChangeBar");

/** Left-margin revision bars (Word "Simple/All Markup"). Pure display decoration. */
export const ChangeBarPlugin = Extension.create({
  name: "reviewChangeBar",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: changeBarKey,
        state: {
          init: (_config, state) => buildChangeBarDecorations(state.doc),
          apply: (tr, value) =>
            tr.docChanged ? buildChangeBarDecorations(tr.doc) : value,
        },
        props: {
          decorations(state) {
            return changeBarKey.getState(state);
          },
        },
      }),
    ];
  },
});
