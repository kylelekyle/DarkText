import type { Editor } from "@tiptap/core";
import { app } from "$lib/stores/app.svelte";

export interface ShortcutContext {
  editor: Editor | null;
}

export interface ShortcutDef {
  id: string;
  keys: string;
  label: string;
  when?: (ctx: ShortcutContext) => boolean;
  run: (ctx: ShortcutContext) => void | Promise<void>;
}

/** Maps menu action ids → shortcut registry ids for a single source of truth. */
export const MENU_SHORTCUT_IDS: Record<string, string> = {
  "file.new": "newChapter",
  "file.save": "save",
  "file.export": "export",
  "edit.find": "findReplace",
  "edit.searchLibrary": "searchLibrary",
  "edit.palette": "quickActions",
  "edit.selectAll": "selectAll",
  "fmt.bold": "bold",
  "fmt.italic": "italic",
  "fmt.underline": "underline",
  "book.compile": "compile",
  "view.sidebar": "sidebar",
  "view.mindmap": "mindmap",
  "view.focus": "focusMode",
};

const shortcutById = new Map<string, ShortcutDef>();

export function shortcutKeysForMenu(menuId: string): string | undefined {
  const sid = MENU_SHORTCUT_IDS[menuId];
  if (!sid) return undefined;
  return shortcutById.get(sid)?.keys;
}

export const SHORTCUTS: ShortcutDef[] = [
  {
    id: "save",
    keys: "Ctrl+S",
    label: "Save All",
    run: () => void app.saveAll(),
  },
  {
    id: "newChapter",
    keys: "Ctrl+N",
    label: "New Chapter",
    run: () => void app.newChapter(),
  },
  {
    id: "quickActions",
    keys: "Ctrl+P",
    label: "Quick Actions",
    run: () => app.toggleQuickActions(),
  },
  {
    id: "findReplace",
    keys: "Ctrl+F",
    label: "Find & Replace",
    run: () => app.openDialog("findReplace"),
  },
  {
    id: "searchLibrary",
    keys: "Ctrl+Shift+F",
    label: "Search Library",
    when: () => !!app.library,
    run: () => app.openDialog("globalSearch"),
  },
  {
    id: "searchChapters",
    keys: "Ctrl+Shift+F",
    label: "Search Chapters",
    when: () => !app.library,
    run: () => app.requestChapterSearchFocus(),
  },
  {
    id: "export",
    keys: "Ctrl+Shift+E",
    label: "Export as…",
    when: () => !!app.activeChapterId,
    run: () => app.openDialog("exportChapter"),
  },
  {
    id: "compile",
    keys: "Ctrl+Shift+C",
    label: "Compile Book",
    run: () => app.openDialog("compile"),
  },
  {
    id: "mindmap",
    keys: "Ctrl+M",
    label: "Mind-map",
    run: () => app.toggleMindMap(),
  },
  {
    id: "sidebar",
    keys: "Ctrl+\\",
    label: "Toggle Sidebar",
    run: () => {
      if (app.focusMode) return;
      app.sidebarCollapsed = !app.sidebarCollapsed;
    },
  },
  {
    id: "focusMode",
    keys: "F11",
    label: "Focus Mode",
    run: () => app.toggleFocusMode(),
  },
  {
    id: "bold",
    keys: "Ctrl+B",
    label: "Bold",
    run: (ctx) => void ctx.editor?.chain().focus().toggleBold().run(),
  },
  {
    id: "italic",
    keys: "Ctrl+I",
    label: "Italic",
    run: (ctx) => void ctx.editor?.chain().focus().toggleItalic().run(),
  },
  {
    id: "underline",
    keys: "Ctrl+U",
    label: "Underline",
    run: (ctx) => void ctx.editor?.chain().focus().toggleUnderline().run(),
  },
  {
    id: "selectAll",
    keys: "Ctrl+A",
    label: "Select All",
    run: (ctx) => void ctx.editor?.chain().focus().selectAll().run(),
  },
];

for (const shortcut of SHORTCUTS) {
  shortcutById.set(shortcut.id, shortcut);
}

const DIALOG_SKIP = new Set(["bold", "italic", "underline"]);

export function shortcutEntriesForDialog(): { keys: string; action: string }[] {
  const seen = new Set<string>();
  const out: { keys: string; action: string }[] = [];
  for (const s of SHORTCUTS) {
    if (DIALOG_SKIP.has(s.id)) continue;
    if (seen.has(s.keys)) continue;
    seen.add(s.keys);
    out.push({ keys: s.keys, action: s.label });
  }
  out.push({ keys: "↑ / ↓", action: "Navigate chapter list" });
  out.push({ keys: "F2", action: "Rename chapter (list focused)" });
  out.push({ keys: "Ctrl+B / I / U", action: "Bold / Italic / Underline" });
  out.push({ keys: "Escape", action: "Close dialog / exit focus / clear search" });
  return out;
}

function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

function matchModifiers(e: KeyboardEvent): { ctrl: boolean; shift: boolean; alt: boolean } {
  return {
    ctrl: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
  };
}

function parseShortcut(keys: string): {
  ctrl: boolean;
  shift: boolean;
  key: string;
} | null {
  const parts = keys.split("+").map((p) => p.trim());
  let ctrl = false;
  let shift = false;
  let key = "";
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "cmd" || lower === "meta") ctrl = true;
    else if (lower === "shift") shift = true;
    else key = part;
  }
  if (!key) return null;
  return { ctrl, shift, key: normalizeKey(key) };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function handleGlobalShortcut(e: KeyboardEvent, ctx: ShortcutContext): boolean {
  if (isTypingTarget(e.target)) return false;

  if (e.key === "F11") {
    e.preventDefault();
    void app.toggleFocusMode();
    return true;
  }

  const mods = matchModifiers(e);
  const key = normalizeKey(e.key);

  for (const shortcut of SHORTCUTS) {
    const parsed = parseShortcut(shortcut.keys);
    if (!parsed) continue;
    if (parsed.ctrl !== mods.ctrl) continue;
    if (parsed.shift !== mods.shift) continue;
    if (parsed.key !== key) continue;
    if (shortcut.when && !shortcut.when(ctx)) continue;
    e.preventDefault();
    void shortcut.run(ctx);
    return true;
  }

  return false;
}