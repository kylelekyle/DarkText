import { describe, expect, it, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Comment, Deletion, Insertion } from "./marks";
import { replaceOneInDocument } from "./search";
import { TrackChangesPlugin, setTrackChangesEnabled } from "./trackChanges";

const editors: Editor[] = [];

function createEditor(content = "<p>Hello world</p>") {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        blockquote: false,
      }),
      Comment,
      Insertion,
      Deletion,
      TrackChangesPlugin,
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

describe("TrackChangesPlugin", () => {
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  it("marks typed insertions", () => {
    const editor = createEditor("<p></p>");
    setTrackChangesEnabled(editor, true);
    editor.chain().focus().insertContent("abc").run();
    expect(editor.getHTML()).toContain("dt-insertion");
  });

  it("marks paste insertions", () => {
    const editor = createEditor("<p>Start</p>");
    setTrackChangesEnabled(editor, true);
    editor.chain().focus().insertContent(" pasted").run();
    expect(editor.getHTML()).toContain("dt-insertion");
  });

  it("keeps deleted text as deletion marks", () => {
    const editor = createEditor("<p>Hello world</p>");
    setTrackChangesEnabled(editor, true);
    editor.chain().focus().setTextSelection({ from: 7, to: 12 }).deleteSelection().run();
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(html).toContain("world");
  });

  it("records find-replace as tracked insertion and deletion", () => {
    const editor = createEditor("<p>foo bar baz</p>");
    setTrackChangesEnabled(editor, true);
    const ok = replaceOneInDocument(editor, "bar", "qux", 0);
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(html).toContain("dt-insertion");
    expect(html).toContain("qux");
  });

  it("extends insertion marks while typing consecutive characters", () => {
    const editor = createEditor("<p></p>");
    setTrackChangesEnabled(editor, true);
    editor.chain().focus().insertContent("a").run();
    editor.chain().focus().insertContent("b").run();
    editor.chain().focus().insertContent("c").run();
    const html = editor.getHTML();
    expect(html).toContain("dt-insertion");
    expect(html.replace(/<[^>]+>/g, "")).toContain("abc");
  });

  it("tracks per editor instance", () => {
    const a = createEditor("<p>a</p>");
    const b = createEditor("<p>b</p>");
    setTrackChangesEnabled(a, true);
    setTrackChangesEnabled(b, false);
    a.chain().focus().insertContent("x").run();
    b.chain().focus().insertContent("y").run();
    expect(a.getHTML()).toContain("dt-insertion");
    expect(b.getHTML()).not.toContain("dt-insertion");
  });
});