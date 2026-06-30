import type { Editor } from "@tiptap/core";
import type Typo from "typo-js";

let checkerPromise: Promise<Typo> | null = null;

/** Load the dictionary in the background so the first context menu stays responsive. */
export function prewarmSpellcheck(): void {
  void getChecker();
}

async function getChecker(): Promise<Typo> {
  if (!checkerPromise) {
    checkerPromise = (async () => {
      const [{ default: TypoCtor }, { default: aff }, { default: dic }] =
        await Promise.all([
          import("typo-js"),
          import("typo-js/dictionaries/en_US/en_US.aff?raw"),
          import("typo-js/dictionaries/en_US/en_US.dic?raw"),
        ]);
      return new TypoCtor("en_US", aff, dic);
    })();
  }
  return checkerPromise;
}

export interface WordAtPoint {
  word: string;
  from: number;
  to: number;
}

const WORD_CHAR = /[\w'-]/;

export function getWordAtEditorPoint(
  editor: Editor,
  x: number,
  y: number,
): WordAtPoint | null {
  const coords = editor.view.posAtCoords({ left: x, top: y });
  if (!coords) return null;

  const $pos = editor.state.doc.resolve(coords.pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;

  const text = parent.textContent;
  const offset = $pos.parentOffset;
  if (!text.length) return null;

  let start = offset;
  let end = offset;

  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
  while (end < text.length && WORD_CHAR.test(text[end])) end++;

  if (start === end) return null;

  const blockStart = $pos.start();
  return {
    word: text.slice(start, end),
    from: blockStart + start,
    to: blockStart + end,
  };
}

export async function isMisspelled(word: string): Promise<boolean> {
  const cleaned = word.replace(/^['-]+|['-]+$/g, "");
  if (!cleaned || cleaned.length < 2 || !/[a-zA-Z]/.test(cleaned)) return false;
  const checker = await getChecker();
  return !checker.check(cleaned);
}

export async function getSpellSuggestions(word: string, limit = 6): Promise<string[]> {
  const cleaned = word.replace(/^['-]+|['-]+$/g, "");
  if (!cleaned || cleaned.length < 2) return [];
  const checker = await getChecker();
  return checker.suggest(cleaned).slice(0, limit);
}

export function applySpellSuggestion(
  editor: Editor,
  from: number,
  to: number,
  suggestion: string,
) {
  editor.chain().focus().deleteRange({ from, to }).insertContent(suggestion).run();
}