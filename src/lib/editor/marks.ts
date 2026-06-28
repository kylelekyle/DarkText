import { Mark, mergeAttributes } from "@tiptap/core";

function idMark(name: string, className: string, dataAttr: string) {
  return Mark.create({
    name,
    addAttributes() {
      return {
        markId: {
          default: null,
          parseHTML: (el) => el.getAttribute(dataAttr),
          renderHTML: (attrs) =>
            attrs.markId ? { [dataAttr]: attrs.markId } : {},
        },
      };
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

export const Comment = idMark("comment", "dt-comment", "data-comment-id");
export const Insertion = idMark("insertion", "dt-insertion", "data-change-id").extend({
  inclusive: true,
});
export const Deletion = idMark("deletion", "dt-deletion", "data-change-id").extend({
  inclusive: false,
});