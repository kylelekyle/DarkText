import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { scrollToTextQuery } from "./navigation";

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