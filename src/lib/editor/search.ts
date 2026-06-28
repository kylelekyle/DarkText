import type { Editor } from "@tiptap/core";

export interface FindOptions {
  caseSensitive?: boolean;
}

function indexOfQuery(
  text: string,
  query: string,
  start: number,
  caseSensitive: boolean,
): number {
  if (caseSensitive) return text.indexOf(query, start);
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  return lowerText.indexOf(lowerQuery, start);
}

/** Find next occurrence of query in document. */
export function findInDocument(
  editor: Editor,
  query: string,
  from = 0,
  options: FindOptions = {},
): { from: number; to: number } | null {
  const q = query.trim();
  if (!q) return null;

  const caseSensitive = options.caseSensitive ?? false;
  const { doc } = editor.state;
  let result: { from: number; to: number } | null = null;

  doc.descendants((node, pos) => {
    if (result || !node.isText || !node.text) return;
    const text = node.text;
    let start = 0;
    while (start < text.length) {
      const idx = indexOfQuery(text, q, start, caseSensitive);
      if (idx < 0) break;
      const matchFrom = pos + idx;
      const matchTo = matchFrom + q.length;
      if (matchFrom >= from) {
        result = { from: matchFrom, to: matchTo };
        return false;
      }
      start = idx + 1;
    }
  });

  return result;
}

function collectMatches(
  editor: Editor,
  query: string,
  options: FindOptions = {},
): { from: number; to: number }[] {
  const matches: { from: number; to: number }[] = [];
  let searchFrom = 0;
  let match = findInDocument(editor, query, searchFrom, options);
  while (match) {
    matches.push(match);
    searchFrom = match.to;
    match = findInDocument(editor, query, searchFrom, options);
  }
  return matches;
}

/** Replace the current or next match; one transaction so track-changes can record the edit. */
export function replaceOneInDocument(
  editor: Editor,
  query: string,
  replacement: string,
  from = 0,
  options: FindOptions = {},
): boolean {
  const q = query.trim();
  if (!q) return false;

  const match = findInDocument(editor, q, from, options);
  if (!match) return false;

  editor.chain().focus().insertContentAt(match, replacement).run();
  return true;
}

/** Replace all occurrences; one transaction per match so track-changes can record each edit. */
export function replaceAllInDocument(
  editor: Editor,
  query: string,
  replacement: string,
  options: FindOptions = {},
): number {
  const q = query.trim();
  if (!q) return 0;

  const matches = collectMatches(editor, q, options);
  if (matches.length === 0) return 0;

  for (let i = matches.length - 1; i >= 0; i--) {
    const { from, to } = matches[i];
    editor.chain().focus().insertContentAt({ from, to }, replacement).run();
  }
  return matches.length;
}