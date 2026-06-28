import type { Editor } from "@tiptap/core";
import { open } from "@tauri-apps/plugin-dialog";
import { libraryStore } from "$lib/stores/library.svelte";
import { formatError } from "$lib/utils/errors";
import * as api from "$lib/api";

export function insertDivider(editor: Editor | null) {
  editor?.chain().focus().setHorizontalRule().run();
}

export function insertSceneBreak(editor: Editor | null) {
  editor
    ?.chain()
    .focus()
    .insertContent('<p class="scene-break" style="text-align:center">* * *</p>')
    .run();
}

export function insertPageBreak(editor: Editor | null) {
  editor
    ?.chain()
    .focus()
    .insertContent('<div class="page-break" data-page-break></div><p></p>')
    .run();
}

export function insertTable(editor: Editor | null) {
  editor
    ?.chain()
    .focus()
    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
    .run();
}

export function insertToc(editor: Editor | null) {
  editor
    ?.chain()
    .focus()
    .insertContent('<p class="toc-placeholder"><em>[Table of Contents]</em></p>')
    .run();
}

export async function insertImage(editor: Editor | null) {
  if (!editor) return;
  if (!libraryStore.library) {
    libraryStore.showToast("Open a Library first");
    return;
  }
  const picked = await open({
    multiple: false,
    title: "Insert image",
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
      },
    ],
  });
  if (!picked || typeof picked !== "string") return;

  try {
    const img = await api.importLibraryImage(libraryStore.library.path, picked);
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: img.relativePath,
          alt: img.filename,
          "data-rel-path": img.relativePath,
        },
      })
      .run();
  } catch (e) {
    libraryStore.showToast(formatError(e));
  }
}