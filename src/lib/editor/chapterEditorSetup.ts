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
import { createLibraryImageExtension } from "$lib/editor/libraryImage";
import { handleEditorMousedown } from "$lib/editor/focus";
import { prepareHtmlForPaste } from "$lib/export/sanitizeHtml";

export interface SpellContextMenuState {
  x: number;
  y: number;
  spellWord?: string;
  spellFrom?: number;
  spellTo?: number;
  spellSuggestions?: string[];
}

export function buildChapterExtensions(libraryPath: string | null) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
      blockquote: false,
    }),
    TextStyle,
    FontSize,
    FontFamily,
    Underline,
    Comment,
    Insertion,
    Deletion,
    TrackChangesPlugin,
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
    handlePaste: (_view: EditorView, event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return false;

      const html = clipboard.getData("text/html")?.trim();
      if (html) {
        const { html: safe, blockedImages } = prepareHtmlForPaste(html);
        if (blockedImages) {
          handlers.notifyBlockedImagePaste();
        }
        if (safe) {
          getEd().chain().focus().insertContent(safe).run();
        }
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
        const base = { x: ev.clientX, y: ev.clientY };
        handlers.setContextMenu(base);
        if (spellcheckOn) {
          const wordInfo = getWordAtEditorPoint(getEd(), ev.clientX, ev.clientY);
          if (wordInfo) {
            void (async () => {
              if (!handlers.isCurrentGen(gen)) return;
              const misspelled = await isMisspelled(wordInfo.word);
              if (!handlers.isCurrentGen(gen)) return;
              if (!misspelled) return;
              const spellSuggestions = await getSpellSuggestions(wordInfo.word);
              if (!handlers.isCurrentGen(gen)) return;
              handlers.setContextMenu({
                ...base,
                spellWord: wordInfo.word,
                spellFrom: wordInfo.from,
                spellTo: wordInfo.to,
                spellSuggestions,
              });
            })();
          }
        }
        return true;
      },
    },
  };
}