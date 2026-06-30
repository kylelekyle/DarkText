import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontSize } from "@tiptap/extension-text-style/font-size";
import FontFamily from "@tiptap/extension-font-family";
import type { EditorView } from "@tiptap/pm/view";
import { getSpellSuggestions, getWordAtEditorPoint, isMisspelled } from "$lib/utils/spellcheck";
import { Comment, Deletion, Insertion } from "$lib/editor/marks";
import { TrackChangesPlugin } from "$lib/editor/trackChanges";
import { ChangeBarPlugin } from "$lib/editor/reviewDecorations";
import { createLibraryImageExtension } from "$lib/editor/libraryImage";
import { handleEditorMousedown } from "$lib/editor/focus";
import { prepareHtmlForPaste } from "$lib/export/sanitizeHtml";
import {
  cursorInComment,
  htmlToInlinePasteText,
  insertInlinePaste,
} from "$lib/editor/paste";

export interface SpellContextMenuState {
  x: number;
  y: number;
  spellWord?: string;
  spellFrom?: number;
  spellTo?: number;
  spellSuggestions?: string[];
  /** Selection captured when the menu opened (right-click clears editor focus). */
  selectionFrom?: number;
  selectionTo?: number;
}

export function buildChapterExtensions(libraryPath: string | null) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
      blockquote: false,
      underline: false,
    }),
    TextStyle,
    FontSize,
    FontFamily,
    Underline,
    Comment,
    Insertion,
    Deletion,
    TrackChangesPlugin,
    ChangeBarPlugin,
    createLibraryImageExtension(libraryPath),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TextAlign.configure({ types: ["paragraph", "heading"] }),
  ];
}

export interface ChapterEditorContextHandlers {
  nextGen: () => number;
  isCurrentGen: (gen: number) => boolean;
  setContextMenu: (menu: SpellContextMenuState | null) => void;
  notifyBlockedImagePaste: () => void;
}

export function buildChapterEditorProps(
  getEd: () => Editor,
  spellcheckOn: boolean,
  handlers: ChapterEditorContextHandlers,
) {
  return {
    attributes: {
      class: "chapter-prose",
      spellcheck: spellcheckOn ? "true" : "false",
    },
    handlePaste: (view: EditorView, event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return false;

      const html = clipboard.getData("text/html")?.trim();
      const plain = clipboard.getData("text/plain") ?? "";

      // Inside a comment, never insert block nodes (keeps the paragraph intact).
      if (cursorInComment(view) && (html || plain)) {
        event.preventDefault();
        const text = html ? htmlToInlinePasteText(prepareHtmlForPaste(html).html || html) : plain;
        if (text) insertInlinePaste(getEd(), text);
        return true;
      }

      if (html) {
        event.preventDefault();
        const { html: safe, blockedImages } = prepareHtmlForPaste(html);
        if (blockedImages) handlers.notifyBlockedImagePaste();
        if (safe) getEd().chain().focus().insertContent(safe).run();
        return true;
      }
      return false;
    },
    handleDOMEvents: {
      mousedown: (view: EditorView, event: Event) => {
        if ((event as MouseEvent).button !== 0) return false;
        return handleEditorMousedown(view, event as MouseEvent);
      },
      contextmenu: (_view: EditorView, event: Event) => {
        event.preventDefault();
        const ev = event as MouseEvent;
        const gen = handlers.nextGen();
        const { from, to, empty } = getEd().state.selection;
        const base = {
          x: ev.clientX,
          y: ev.clientY,
          selectionFrom: empty ? undefined : from,
          selectionTo: empty ? undefined : to,
        };
        handlers.setContextMenu(base);
        // Selection context menus are for comments/format — skip heavy spell lookup.
        if (spellcheckOn && empty) {
          const wordInfo = getWordAtEditorPoint(getEd(), ev.clientX, ev.clientY);
          if (wordInfo) {
            const spellBase = { ...base };
            queueMicrotask(() => {
              void (async () => {
                if (!handlers.isCurrentGen(gen)) return;
                const misspelled = await isMisspelled(wordInfo.word);
                if (!handlers.isCurrentGen(gen)) return;
                if (!misspelled) return;
                const spellSuggestions = await getSpellSuggestions(wordInfo.word);
                if (!handlers.isCurrentGen(gen)) return;
                handlers.setContextMenu({
                  ...spellBase,
                  spellWord: wordInfo.word,
                  spellFrom: wordInfo.from,
                  spellTo: wordInfo.to,
                  spellSuggestions,
                });
              })();
            });
          }
        }
        return true;
      },
    },
  };
}