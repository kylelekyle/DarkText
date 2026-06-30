import { describe, expect, it, afterEach } from "vitest";
import type { Editor } from "@tiptap/core";
import { toggleTrackedDeletionMark } from "$lib/editor/formatActions";
import { applyChangeInEditor } from "$lib/editor/review";
import { replaceAllInDocument, replaceOneInDocument } from "$lib/editor/search";
import { setTrackChangesEnabled } from "$lib/editor/trackChanges";
import {
  countSubstring,
  createTrackedEditor,
  editorPlainText,
  selectText,
} from "$lib/editor/trackChangesTestUtils";

const editors: Editor[] = [];

function track(content = "<p>Hello world</p>", enabled = true) {
  const editor = createTrackedEditor(content, enabled);
  editors.push(editor);
  return editor;
}

describe("TrackChangesPlugin", () => {
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  it("marks typed insertions", () => {
    const editor = track("<p></p>");
    editor.chain().focus().insertContent("abc").run();
    expect(editor.getHTML()).toContain("dt-insertion");
    expect(editorPlainText(editor)).toBe("abc");
  });

  it("keeps deleted text as deletion marks", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(html).toContain("world");
    expect(editorPlainText(editor)).toContain("Hello world");
  });

  it("undoes a tracked deletion without duplicating text", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    expect(editor.getHTML()).toContain("dt-deletion");
    editor.chain().focus().undo().run();
    expect(editor.getHTML()).not.toContain("dt-deletion");
    expect(editorPlainText(editor)).toBe("Hello world");
    expect(countSubstring(editorPlainText(editor), "world")).toBe(1);
  });

  it("redoes a tracked deletion", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    editor.chain().focus().undo().run();
    editor.chain().focus().redo().run();
    expect(editor.getHTML()).toContain("dt-deletion");
    expect(editorPlainText(editor)).toContain("world");
  });

  it("does not stack deletion re-insert when deleting struck-through text", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    const afterFirst = editor.getHTML();
    expect(countSubstring(afterFirst, "world")).toBe(1);
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    const html = editor.getHTML();
    expect(countSubstring(html, "world")).toBeLessThanOrEqual(1);
    expect(countSubstring(html, "dt-deletion")).toBeLessThanOrEqual(1);
  });

  it("records find-replace as tracked insertion and deletion", () => {
    const editor = track("<p>foo bar baz</p>");
    const ok = replaceOneInDocument(editor, "bar", "qux", 0);
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(html).toContain("dt-insertion");
    // Word-style: deleted "bar" stays visible (struck through) beside insertion "qux"
    expect(editorPlainText(editor)).toContain("bar");
    expect(editorPlainText(editor)).toContain("qux");
    expect(editorPlainText(editor)).toContain("foo");
    expect(editorPlainText(editor)).toContain("baz");
  });

  it("replaces text cleanly when tracking is off", () => {
    const editor = track("<p>foo bar baz</p>", false);
    replaceOneInDocument(editor, "bar", "qux", 0);
    expect(editorPlainText(editor)).toBe("foo qux baz");
  });

  it("tracks each replace-all match separately", () => {
    const editor = track("<p>cat cat cat</p>");
    const n = replaceAllInDocument(editor, "cat", "dog");
    expect(n).toBe(3);
    const html = editor.getHTML();
    expect(html).toContain("dt-insertion");
    expect(html).toContain("dt-deletion");
    expect(countSubstring(html, "dt-deletion")).toBe(3);
    expect(countSubstring(html, "dt-insertion")).toBe(3);
    expect(editorPlainText(editor)).toContain("cat");
    expect(editorPlainText(editor)).toContain("dog");
  });

  it("does not add marks when tracking is disabled", () => {
    const editor = track("<p>Hi</p>", false);
    editor.chain().focus().insertContent(" there").run();
    expect(editor.getHTML()).not.toContain("dt-insertion");
  });

  it("round-trips HTML through setContent without duplicating story text", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    editor.chain().focus().insertContentAt(7, " there").run();
    const saved = editor.getHTML();
    editor.commands.setContent(saved, { emitUpdate: false });
    expect(countSubstring(editorPlainText(editor), "world")).toBe(1);
    expect(countSubstring(editorPlainText(editor), "there")).toBe(1);
  });

  it("accepts an insertion while tracking is enabled", () => {
    const editor = track("<p>Hi</p>");
    editor.chain().focus("end").insertContent(" there").run();
    const markId =
      editor.getHTML().match(/data-change-id="([^"]+)"/)?.[1] ?? "";
    expect(markId).not.toBe("");
    const ok = applyChangeInEditor(
      editor,
      {
        id: markId,
        markId,
        type: "insertion",
        text: " there",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      "accept",
    );
    expect(ok).toBe(true);
    expect(editor.getHTML()).not.toContain("dt-insertion");
    expect(editorPlainText(editor)).toBe("Hi there");
  });

  it("rejects a tracked deletion while tracking is enabled", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    const markId =
      editor.getHTML().match(/dt-deletion[^>]*data-change-id="([^"]+)"/)?.[1] ??
      editor.getHTML().match(/data-change-id="([^"]+)"/)?.[1] ??
      "";
    expect(markId).not.toBe("");
    const ok = applyChangeInEditor(
      editor,
      {
        id: markId,
        markId,
        type: "deletion",
        text: "world",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      "reject",
    );
    expect(ok).toBe(true);
    expect(editor.getHTML()).not.toContain("dt-deletion");
    expect(editorPlainText(editor)).toBe("Hello world");
  });

  it("tracks typing inside a table cell", () => {
    const editor = track(
      "<table><tbody><tr><td><p>Cell A1</p></td><td><p>Cell B1</p></td></tr></tbody></table>",
    );
    expect(selectText(editor, "Cell A1")).toBe(true);
    editor.chain().focus().setTextSelection({ from: editor.state.selection.to, to: editor.state.selection.to }).insertContent("!").run();
    expect(editor.getHTML()).toContain("dt-insertion");
    expect(editor.getHTML()).toContain("<table");
    expect(editorPlainText(editor)).toContain("Cell A1!");
  });

  it("tracks deletion inside a table cell", () => {
    const editor = track(
      "<table><tbody><tr><td><p>Cell A1</p></td><td><p>Cell B1</p></td></tr></tbody></table>",
    );
    expect(selectText(editor, "A1")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    expect(editor.getHTML()).toContain("dt-deletion");
    expect(editor.getHTML()).toContain("<table");
    expect(editorPlainText(editor)).toContain("A1");
  });

  it("tracks per editor instance", () => {
    const a = track("<p>a</p>");
    const b = track("<p>b</p>", false);
    a.chain().focus().insertContent("x").run();
    b.chain().focus().insertContent("y").run();
    expect(a.getHTML()).toContain("dt-insertion");
    expect(b.getHTML()).not.toContain("dt-insertion");
  });

  it("marks a single backspace deletion", () => {
    const editor = track("<p>hello world</p>");
    editor.chain().focus("end").run();
    const pos = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: pos - 1, to: pos }).run();
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(editorPlainText(editor)).toBe("hello world");
  });

  it("marks consecutive backspace deletions as one region", () => {
    const editor = track("<p>hello world</p>");
    editor.chain().focus("end").run();
    for (let i = 0; i < 6; i++) {
      const pos = editor.state.selection.from;
      editor.chain().focus().deleteRange({ from: pos - 1, to: pos }).run();
    }
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(editorPlainText(editor)).toBe("hello world");
    const markIds = [
      ...html.matchAll(/data-change-id="([^"]+)"/g),
    ].map((m) => m[1]);
    const delIds = new Set(markIds);
    expect(delIds.size).toBe(1);
  });

  it("undoes consecutive backspace deletions without losing struck text", () => {
    const editor = track("<p>hello world</p>");
    editor.chain().focus("end").run();
    for (let i = 0; i < 6; i++) {
      const pos = editor.state.selection.from;
      editor.chain().focus().deleteRange({ from: pos - 1, to: pos }).run();
    }
    expect(editor.getHTML()).toContain("dt-deletion");
    editor.chain().focus().undo().run();
    expect(editorPlainText(editor)).toContain("world");
    expect(countSubstring(editorPlainText(editor), "world")).toBe(1);
  });

  it("tracks full-paragraph replace as one deletion and one insertion", () => {
    const editor = track("<p>hello world</p>");
    const ok = replaceOneInDocument(editor, "hello world", "hi", 0);
    expect(ok).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(html).toContain("dt-insertion");
    expect(editorPlainText(editor)).toContain("hello world");
    // Replacement text must appear outside deletion marks (Word-style).
    expect(html).toMatch(/dt-insertion[^>]*>hi</);
    expect(countSubstring(html, "dt-deletion")).toBe(1);
  });

  it("does not strike through text typed over a deletion region", () => {
    const editor = track("<p>hello world</p>");
    expect(selectText(editor, "world")).toBe(true);
    editor.chain().focus().deleteSelection().run();
    const strikeFrom = editor.state.selection.from;
    editor.chain().focus().insertContentAt(strikeFrom, "X").run();
    const html = editor.getHTML();
    expect(html).toContain("dt-insertion");
    const insOnly = html.match(
      /dt-insertion[^>]*>X</,
    );
    expect(insOnly).toBeTruthy();
    expect(html).not.toMatch(/dt-deletion[^>]*>X</);
  });

  it("leaves undo to history without re-tracking", () => {
    const editor = track("<p>Hi</p>");
    editor.chain().focus("end").insertContent(" there").run();
    expect(editor.getHTML()).toContain("dt-insertion");
    editor.chain().focus().undo().run();
    expect(editor.getHTML()).not.toContain("dt-insertion");
    expect(editorPlainText(editor)).toBe("Hi");
  });

  it("re-enabling tracking preserves existing marks and tracks new edits", () => {
    const editor = track("<p>Start</p>", false);
    editor.chain().focus("end").insertContent(" one").run();
    expect(editor.getHTML()).not.toContain("dt-insertion");
    setTrackChangesEnabled(editor, true);
    editor.chain().focus("end").insertContent(" two").run();
    expect(editor.getHTML()).toContain("dt-insertion");
    expect(editorPlainText(editor)).toBe("Start one two");
  });

  it("toolbar strikethrough applies a review deletion mark", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    toggleTrackedDeletionMark(editor);
    const html = editor.getHTML();
    expect(html).toContain("dt-deletion");
    expect(html).not.toContain("<s>");
    expect(html).toMatch(/dt-deletion[^>]*>world</);
  });

  it("toolbar strikethrough removes an existing deletion mark", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    toggleTrackedDeletionMark(editor);
    expect(editor.getHTML()).toContain("dt-deletion");
    toggleTrackedDeletionMark(editor);
    expect(editor.getHTML()).not.toContain("dt-deletion");
    expect(editorPlainText(editor)).toBe("Hello world");
  });

  it("undoes toolbar deletion mark without duplicating text", () => {
    const editor = track();
    expect(selectText(editor, "world")).toBe(true);
    toggleTrackedDeletionMark(editor);
    expect(editor.getHTML()).toContain("dt-deletion");
    editor.chain().focus().undo().run();
    expect(editor.getHTML()).not.toContain("dt-deletion");
    expect(editorPlainText(editor)).toBe("Hello world");
  });
});