import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  findInDocument,
  replaceAllInDocument,
  replaceOneInDocument,
} from "./search";

function editorWith(text: string) {
  return new Editor({
    extensions: [StarterKit],
    content: `<p>${text}</p>`,
  });
}

describe("findInDocument", () => {
  it("finds case-insensitive matches", () => {
    const editor = editorWith("Hello World");
    const match = findInDocument(editor, "world");
    expect(match).not.toBeNull();
    expect(match!.to - match!.from).toBe(5);
    editor.destroy();
  });

  it("returns null for empty query", () => {
    const editor = editorWith("Hello");
    expect(findInDocument(editor, "   ")).toBeNull();
    editor.destroy();
  });

  it("respects case-sensitive matching", () => {
    const editor = editorWith("Hello hello");
    expect(findInDocument(editor, "Hello", 0, { caseSensitive: true })).not.toBeNull();
    expect(findInDocument(editor, "hello", 0, { caseSensitive: true })).not.toBeNull();
    editor.destroy();
  });
});

describe("replaceAllInDocument", () => {
  it("replaces all occurrences", () => {
    const editor = editorWith("foo bar foo");
    const count = replaceAllInDocument(editor, "foo", "baz");
    expect(count).toBe(2);
    expect(editor.getText()).toContain("baz bar baz");
    editor.destroy();
  });
});

describe("replaceOneInDocument", () => {
  it("replaces a single occurrence", () => {
    const editor = editorWith("foo bar foo");
    const replaced = replaceOneInDocument(editor, "foo", "baz");
    expect(replaced).toBe(true);
    expect(editor.getText()).toContain("baz bar foo");
    editor.destroy();
  });

  it("replaces entire paragraph text including shared-prefix matches", () => {
    const editor = editorWith("hello world");
    const match = findInDocument(editor, "hello world");
    expect(match).toEqual({ from: 1, to: 12 });
    const replaced = replaceOneInDocument(editor, "hello world", "hi");
    expect(replaced).toBe(true);
    expect(editor.getText().trim()).toBe("hi");
    editor.destroy();
  });
});