import { describe, expect, it, afterEach } from "vitest";
import type { Editor } from "@tiptap/core";
import { buildChapterExtensions } from "$lib/editor/chapterEditorSetup";
import { Editor as TiptapEditor } from "@tiptap/core";
import {
  collapsePasteText,
  htmlToInlinePasteText,
  insertInlinePaste,
} from "$lib/editor/paste";
import { setTrackChangesEnabled } from "$lib/editor/trackChanges";

const editors: Editor[] = [];

function editorWith(html: string, track = false) {
  const editor = new TiptapEditor({
    extensions: buildChapterExtensions(null),
    content: html,
  });
  setTrackChangesEnabled(editor, track);
  editors.push(editor);
  return editor;
}

describe("paste helpers", () => {
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  it("collapses newlines to spaces", () => {
    expect(collapsePasteText("line one\nline two")).toBe("line one line two");
  });

  it("extracts inline text from HTML blocks", () => {
    expect(htmlToInlinePasteText("<p>Hello</p><p>World</p>")).toBe("Hello World");
  });

  it("pastes inside a comment without creating a new paragraph", () => {
    const editor = editorWith(
      '<p>Before <span class="dt-comment" data-comment-id="c1">commented</span> after</p>',
      true,
    );
    let insertPos = 0;
    editor.state.doc.descendants((node, pos) => {
      if (insertPos || !node.isText || !node.text?.includes("commented")) return;
      insertPos = pos + node.text.indexOf("commented") + "commented".length;
    });
    editor.chain().focus().setTextSelection(insertPos).run();
    insertInlinePaste(editor, " pasted");
    expect(editor.getHTML()).not.toContain("</p><p>");
    expect(editor.getText()).toContain("commented pasted");
  });
});