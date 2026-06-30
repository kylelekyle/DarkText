import { Mark, mergeAttributes } from "@tiptap/core";

interface IdMarkOptions {
  /** Also carry a `data-author` attribute (used by tracked-change marks). */
  withAuthor?: boolean;
}

function idMark(
  name: string,
  className: string,
  dataAttr: string,
  options: IdMarkOptions = {},
) {
  return Mark.create({
    name,
    addAttributes() {
      const attrs: Record<string, unknown> = {
        markId: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute(dataAttr),
          renderHTML: (a: Record<string, unknown>) =>
            a.markId ? { [dataAttr]: a.markId } : {},
        },
      };
      if (options.withAuthor) {
        attrs.author = {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute("data-author"),
          renderHTML: (a: Record<string, unknown>) =>
            a.author ? { "data-author": a.author } : {},
        };
      }
      return attrs;
    },
    parseHTML() {
      return [{ tag: `span[${dataAttr}]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        "span",
        mergeAttributes(HTMLAttributes, { class: className }),
        0,
      ];
    },
  });
}

export const Comment = idMark("comment", "dt-comment", "data-comment-id").extend({
  inclusive: false,
});
export const Insertion = idMark("insertion", "dt-insertion", "data-change-id", {
  withAuthor: true,
}).extend({
  inclusive: true,
});
export const Deletion = idMark("deletion", "dt-deletion", "data-change-id", {
  withAuthor: true,
}).extend({
  inclusive: false,
});
