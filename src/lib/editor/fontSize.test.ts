import { describe, expect, it, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { buildChapterExtensions } from "./chapterEditorSetup";
import {
  applyStickyFontSize,
  fontSizeMarkAtEditor,
  stickyFontSizeIsActive,
} from "./fontSize";

const editors: Editor[] = [];

function createEditor(content = "<p>Hello world</p>") {
  const editor = new Editor({
    extensions: buildChapterExtensions(null),
    content,
  });
  editors.push(editor);
  return editor;
}

describe("chapter editor font size", () => {
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  it("applies font-size marks to selected text", () => {
    const editor = createEditor();
    editor.chain().focus().selectAll().setFontSize("18pt").run();
    expect(editor.getHTML()).toContain("font-size: 18pt");
    editor.chain().focus().selectAll().setFontSize("20pt").run();
    expect(editor.getHTML()).toContain("font-size: 20pt");
    expect(editor.getHTML()).not.toContain("font-size: 18pt");
  });

  it("stores font size for new typing on an empty selection", () => {
    const editor = createEditor("<p></p>");
    editor.chain().focus().setFontSize("20pt").run();
    editor.chain().focus().insertContent("Sized").run();
    expect(editor.getHTML()).toContain("font-size: 20pt");
    expect(editor.getHTML()).toContain("Sized");
  });

  it("reads the active size from stored typing marks", () => {
    const editor = createEditor("<p></p>");
    editor.chain().focus().setFontSize("20pt").run();
    expect(fontSizeMarkAtEditor(editor)).toBe("20");
    expect(stickyFontSizeIsActive(editor, "20")).toBe(true);
  });

  it("re-applies sticky font size for new typing after the cursor moves", () => {
    const editor = createEditor("<p>Hello</p>");
    editor.chain().focus().setTextSelection(6).setFontSize("20pt").run();
    applyStickyFontSize(editor, "20");
    editor.chain().focus().insertContent(" world").run();
    expect(editor.getHTML()).toContain('font-size: 20pt');
    expect(editor.getHTML()).toContain("world");
  });
});