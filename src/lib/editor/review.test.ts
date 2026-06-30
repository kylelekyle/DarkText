import { describe, expect, it, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Comment, Deletion, Insertion } from "./marks";
import { TrackChangesPlugin } from "./trackChanges";
import {
  applyChangeInEditor,
  collectCommentMarkIdsFromEditor,
  syncChangesFromEditor,
  syncChangesFromHtml,
} from "./review";

const editors: Editor[] = [];

function createEditor(content: string) {
  const editor = new Editor({
    extensions: [StarterKit, Comment, Insertion, Deletion],
    content,
  });
  editors.push(editor);
  return editor;
}

describe("collectCommentMarkIdsFromEditor", () => {
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  it("finds comment marks in the document", () => {
    const editor = createEditor(
      '<p>Hello <span class="dt-comment" data-comment-id="c-1">world</span></p>',
    );
    const ids = collectCommentMarkIdsFromEditor(editor);
    expect(ids.has("c-1")).toBe(true);
    expect(ids.size).toBe(1);
  });

  it("returns empty when commented text was deleted", () => {
    const editor = createEditor("<p>Hello world</p>");
    expect(collectCommentMarkIdsFromEditor(editor).size).toBe(0);
  });
});

describe("syncChangesFromEditor", () => {
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  it("discovers insertion marks from the live document", () => {
    const editor = createEditor(
      '<p>Hello <span class="dt-insertion" data-change-id="live-1">world</span></p>',
    );
    const changes = syncChangesFromEditor(editor, []);
    expect(changes).toHaveLength(1);
    expect(changes[0].markId).toBe("live-1");
    expect(changes[0].type).toBe("insertion");
  });
});

describe("syncChangesFromHtml", () => {
  it("discovers insertion marks in html", () => {
    const html =
      '<p>Hello <span class="dt-insertion" data-change-id="abc-1">world</span></p>';
    const changes = syncChangesFromHtml(html, []);
    expect(changes).toHaveLength(1);
    expect(changes[0].markId).toBe("abc-1");
    expect(changes[0].type).toBe("insertion");
    expect(changes[0].status).toBe("pending");
  });

  it("preserves existing change metadata", () => {
    const html =
      '<p><span class="dt-deletion" data-change-id="del-1">gone</span></p>';
    const existing = [
      {
        id: "del-1",
        markId: "del-1",
        type: "deletion" as const,
        text: "gone",
        status: "accepted" as const,
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ];
    const changes = syncChangesFromHtml(html, existing);
    expect(changes[0].status).toBe("accepted");
  });

  it("captures the reviewer name from data-author", () => {
    const html =
      '<p><span class="dt-insertion" data-change-id="a-1" data-author="Editor">hi</span></p>';
    const changes = syncChangesFromHtml(html, []);
    expect(changes[0].author).toBe("Editor");
  });
});

describe("applyChangeInEditor", () => {
  afterEach(() => {
    while (editors.length) editors.pop()?.destroy();
  });

  it("accepts an insertion change", () => {
    const editor = new Editor({
      extensions: [StarterKit, Comment, Insertion, Deletion, TrackChangesPlugin],
      content:
        '<p>Hi <span class="dt-insertion" data-change-id="ins-1">there</span></p>',
    });
    editors.push(editor);

    const ok = applyChangeInEditor(
      editor,
      {
        id: "ins-1",
        markId: "ins-1",
        type: "insertion",
        text: "there",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      "accept",
    );
    expect(ok).toBe(true);
    expect(editor.getHTML()).not.toContain("dt-insertion");
    expect(editor.getHTML()).toContain("there");
  });

  it("rejects a deletion change", () => {
    const editor = new Editor({
      extensions: [StarterKit, Comment, Insertion, Deletion, TrackChangesPlugin],
      content: "<p>gone</p>",
    });
    editors.push(editor);
    editor
      .chain()
      .focus()
      .setTextSelection({ from: 1, to: 5 })
      .setMark("deletion", { markId: "del-1" })
      .run();

    const ok = applyChangeInEditor(
      editor,
      {
        id: "del-1",
        markId: "del-1",
        type: "deletion",
        text: "gone",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      "reject",
    );
    expect(ok).toBe(true);
    expect(editor.getHTML()).not.toContain("dt-deletion");
    expect(editor.getHTML()).toContain("gone");
  });
});