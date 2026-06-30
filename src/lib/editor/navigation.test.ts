import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { orderedReviewItems, scrollToTextQuery } from "./navigation";
import { Comment, Deletion, Insertion } from "./marks";

function editorWith(text: string) {
  return new Editor({
    extensions: [StarterKit],
    content: `<p>${text}</p>`,
  });
}

describe("scrollToTextQuery", () => {
  it("finds the closest plain-text match offset", () => {
    const editor = editorWith("foo bar foo");
    const ok = scrollToTextQuery(editor, "foo", 8);
    expect(ok).toBe(true);
    const { from, to } = editor.state.selection;
    expect(to - from).toBe(3);
    editor.destroy();
  });

  it("returns false for empty query", () => {
    const editor = editorWith("hello");
    expect(scrollToTextQuery(editor, "   ")).toBe(false);
    editor.destroy();
  });

  it("falls back to first match when matchIndex does not align", () => {
    const editor = editorWith("alpha beta alpha");
    const ok = scrollToTextQuery(editor, "alpha", 99);
    expect(ok).toBe(true);
    editor.destroy();
  });
});

describe("orderedReviewItems", () => {
  it("lists changes and comments in document order", () => {
    const editor = new Editor({
      extensions: [StarterKit, Comment, Insertion, Deletion],
      content:
        '<p><span class="dt-insertion" data-change-id="ins-1">new</span> mid ' +
        '<span class="dt-comment" data-comment-id="c-1">note</span> end ' +
        '<span class="dt-deletion" data-change-id="del-1">gone</span></p>',
    });
    const items = orderedReviewItems(editor);
    expect(items.map((i) => i.markId)).toEqual(["ins-1", "c-1", "del-1"]);
    expect(items.map((i) => i.kind)).toEqual(["change", "comment", "change"]);
    // Positions strictly increase in reading order.
    expect(items[0].pos).toBeLessThan(items[1].pos);
    expect(items[1].pos).toBeLessThan(items[2].pos);
    editor.destroy();
  });
});