import { open } from "@tauri-apps/plugin-dialog";
import type { Editor } from "@tiptap/core";
import { app } from "$lib/stores/app.svelte";
import { chapterStore } from "$lib/stores/chapter.svelte";
import { sectionItemLabel } from "$lib/utils/chapterDisplay";
import {
  insertDivider,
  insertImage,
  insertPageBreak,
  insertSceneBreak,
  insertTable,
  insertToc,
} from "$lib/editor/insert";
import { setParagraphAlignment } from "$lib/editor/align";
import { shortcutKeysForMenu } from "$lib/shortcuts/registry";
import { formatError } from "$lib/utils/errors";
import type { ChapterSection, MenuAction } from "$lib/types";

function menuShortcut(id: string): string | undefined {
  return shortcutKeysForMenu(id);
}

export interface ActionContext {
  editor: Editor | null;
  hasLibrary: boolean;
  hasChapter: boolean;
  pendingCount: number;
  activeSection: ChapterSection;
  sidebarTab: ChapterSection;
  canUndo: boolean;
  canRedo: boolean;
}

export function defaultMenuActionContext(
  editor: Editor | null,
  opts: { openMenu?: string | null; trackAll?: boolean } = {},
): ActionContext {
  const openMenu = opts.openMenu ?? null;
  const trackAll = opts.trackAll ?? false;
  return {
    editor,
    hasLibrary: !!app.library,
    hasChapter: !!app.activeChapterId,
    pendingCount:
      trackAll || openMenu === "Review" ? app.pendingChanges.length : 0,
    activeSection: chapterStore.activeSection,
    sidebarTab: app.sidebarTab,
    canUndo:
      trackAll || openMenu === "Edit"
        ? (editor?.can().undo() ?? false)
        : false,
    canRedo:
      trackAll || openMenu === "Edit"
        ? (editor?.can().redo() ?? false)
        : false,
  };
}

async function pickLibrary(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open Library",
  });
  return typeof selected === "string" ? selected : null;
}

export function buildMenuActions(ctx: ActionContext): MenuAction[] {
  const {
    editor,
    hasLibrary,
    hasChapter,
    pendingCount,
    activeSection,
    sidebarTab,
    canUndo,
    canRedo,
  } = ctx;

  return [
    // File
    {
      id: "file.new",
      label: sectionItemLabel(sidebarTab, "new"),
      shortcut: menuShortcut("file.new"),
      group: "File",
      run: () => void app.newChapter(undefined, sidebarTab),
    },
    {
      id: "file.open",
      label: "Open Library…",
      group: "File",
      run: () => void (async () => {
        try {
          const p = await pickLibrary();
          if (p) await app.requestOpenLibrary(p);
        } catch (e) {
          app.showToast(formatError(e));
        }
      })(),
    },
    {
      id: "file.create",
      label: "Create Library…",
      group: "File",
      run: () => void (async () => {
        try {
          const p = await pickLibrary();
          if (p) await app.requestCreateLibrary(p, p.split(/[/\\]/).pop() || "Library");
        } catch (e) {
          app.showToast(formatError(e));
        }
      })(),
    },
    { id: "file.save", label: "Save All", shortcut: menuShortcut("file.save"), group: "File", run: () => void app.saveAll() },
    {
      id: "file.snapshots",
      label: sectionItemLabel(activeSection, "snapshots"),
      group: "File",
      disabled: !hasChapter,
      run: () => app.openDialog("chapterSnapshots"),
    },
    {
      id: "file.export",
      label: "Export as…",
      shortcut: menuShortcut("file.export"),
      group: "File",
      disabled: !hasChapter,
      run: () => {
        app.exportFormat = "html";
        app.openDialog("exportChapter");
      },
    },
    {
      id: "file.export.html",
      label: "HTML",
      group: "File",
      disabled: !hasChapter,
      run: () => {
        app.exportFormat = "html";
        app.openDialog("exportChapter");
      },
    },
    {
      id: "file.export.md",
      label: "Markdown",
      group: "File",
      disabled: !hasChapter,
      run: () => {
        app.exportFormat = "markdown";
        app.openDialog("exportChapter");
      },
    },
    {
      id: "file.export.docx",
      label: "Word (.docx)",
      group: "File",
      disabled: !hasChapter,
      run: () => {
        app.exportFormat = "docx";
        app.openDialog("exportChapter");
      },
    },
    {
      id: "file.export.text",
      label: "Plain Text",
      group: "File",
      disabled: !hasChapter,
      run: () => {
        app.exportFormat = "text";
        app.openDialog("exportChapter");
      },
    },
    { id: "file.close", label: "Close Library", group: "File", run: () => void app.requestCloseLibrary() },

    // Edit
    { id: "edit.undo", label: "Undo", shortcut: "Ctrl+Z", group: "Edit", disabled: !canUndo, run: () => editor?.chain().focus().undo().run() },
    { id: "edit.redo", label: "Redo", shortcut: "Ctrl+Y", group: "Edit", disabled: !canRedo, run: () => editor?.chain().focus().redo().run() },
    { id: "edit.find", label: "Find & Replace…", shortcut: menuShortcut("edit.find"), group: "Edit", run: () => app.openDialog("findReplace") },
    {
      id: "edit.searchLibrary",
      label: "Search Library",
      shortcut: menuShortcut("edit.searchLibrary"),
      group: "Edit",
      disabled: !hasLibrary,
      run: () => app.openDialog("globalSearch"),
    },
    { id: "edit.palette", label: "Quick Actions", shortcut: menuShortcut("edit.palette"), group: "Edit", run: () => app.toggleQuickActions() },
    { id: "edit.selectAll", label: "Select All", shortcut: menuShortcut("edit.selectAll"), group: "Edit", run: () => editor?.chain().focus().selectAll().run() },
    {
      id: "edit.rename",
      label: sectionItemLabel(activeSection, "rename"),
      group: "Edit",
      disabled: !hasChapter,
      run: () => app.openDialog("renameChapter"),
    },
    {
      id: "edit.duplicate",
      label: sectionItemLabel(activeSection, "duplicate"),
      group: "Edit",
      disabled: !hasChapter,
      run: () => void app.duplicateActiveChapter(),
    },
    {
      id: "edit.delete",
      label: sectionItemLabel(activeSection, "delete"),
      group: "Edit",
      disabled: !hasChapter,
      run: () => void app.deleteActiveChapter(),
    },

    // Insert
    { id: "insert.divider", label: "Divider", group: "Insert", run: () => insertDivider(editor) },
    { id: "insert.scene", label: "Scene Break", group: "Insert", run: () => insertSceneBreak(editor) },
    { id: "insert.page", label: "Page Break", group: "Insert", run: () => insertPageBreak(editor) },
    { id: "insert.toc", label: "Table of Contents", group: "Insert", run: () => insertToc(editor) },
    { id: "insert.image", label: "Image…", group: "Insert", run: () => void insertImage(editor) },
    { id: "insert.table", label: "Table", group: "Insert", run: () => insertTable(editor) },

    // Format
    { id: "fmt.bold", label: "Bold", shortcut: menuShortcut("fmt.bold"), group: "Format", run: () => editor?.chain().focus().toggleBold().run() },
    { id: "fmt.italic", label: "Italic", shortcut: menuShortcut("fmt.italic"), group: "Format", run: () => editor?.chain().focus().toggleItalic().run() },
    { id: "fmt.underline", label: "Underline", shortcut: menuShortcut("fmt.underline"), group: "Format", run: () => editor?.chain().focus().toggleUnderline().run() },
    { id: "fmt.strike", label: "Strikethrough", group: "Format", run: () => editor?.chain().focus().toggleStrike().run() },
    { id: "fmt.left", label: "Align Left", group: "Format", run: () => editor && setParagraphAlignment(editor, "left") },
    { id: "fmt.center", label: "Align Center", group: "Format", run: () => editor && setParagraphAlignment(editor, "center") },
    { id: "fmt.right", label: "Align Right", group: "Format", run: () => editor && setParagraphAlignment(editor, "right") },
    { id: "fmt.justify", label: "Justify", group: "Format", run: () => editor && setParagraphAlignment(editor, "justify") },
    { id: "fmt.h2", label: "Heading 2", group: "Format", run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: "fmt.h3", label: "Heading 3", group: "Format", run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: "fmt.clear", label: "Clear Formatting", group: "Format", run: () => editor?.chain().focus().clearNodes().unsetAllMarks().run() },

    // Review
    { id: "review.comment", label: "Add comment…", group: "Review", disabled: !hasChapter, run: () => app.addCommentOnSelection() },
    { id: "review.track", label: "Track changes", group: "Review", run: () => app.toggleTrackChanges() },
    { id: "review.accept", label: "Accept all changes", group: "Review", disabled: pendingCount === 0, run: () => app.acceptAllChanges() },
    { id: "review.reject", label: "Reject all changes", group: "Review", disabled: pendingCount === 0, run: () => app.rejectAllChanges() },
    {
      id: "review.summary",
      label: "Manuscript review summary…",
      group: "Review",
      disabled: !hasLibrary,
      run: () => app.openDialog("libraryReview"),
    },
    {
      id: "review.handoff",
      label: "Editor handoff…",
      group: "Review",
      disabled: !hasLibrary,
      run: () => app.openDialog("editorHandoff"),
    },
    {
      id: "review.panel",
      label: "Show Review panel",
      group: "Review",
      run: () => {
        if (app.mode !== "editor") app.setMode("editor");
        app.showReviewPanel = true;
      },
    },
    // Book
    { id: "book.settings", label: "Book settings…", group: "Book", run: () => app.openDialog("bookSettings") },
    { id: "book.compile", label: "Compile Book…", shortcut: menuShortcut("book.compile"), group: "Book", run: () => app.openDialog("compile") },
    { id: "book.compile.html", label: "Compile as HTML", group: "Book", run: () => { app.compileFormat = "html"; app.openDialog("compile"); } },
    { id: "book.compile.md", label: "Compile as Markdown", group: "Book", run: () => { app.compileFormat = "markdown"; app.openDialog("compile"); } },
    { id: "book.compile.txt", label: "Compile as Text", group: "Book", run: () => { app.compileFormat = "text"; app.openDialog("compile"); } },
    { id: "book.compile.docx", label: "Compile as Word", group: "Book", run: () => { app.compileFormat = "docx"; app.openDialog("compile"); } },
    { id: "book.compile.epub", label: "Compile as EPUB", group: "Book", run: () => { app.compileFormat = "epub"; app.openDialog("compile"); } },

    // View
    { id: "view.sidebar", label: "Toggle Sidebar", shortcut: menuShortcut("view.sidebar"), group: "View", run: () => { app.sidebarCollapsed = !app.sidebarCollapsed; } },
    {
      id: "view.split",
      label: app.splitViewEnabled ? "Close Split View" : "Split View",
      shortcut: menuShortcut("view.split"),
      group: "View",
      disabled: !hasLibrary || app.focusMode,
      run: () => void app.toggleSplitView(),
    },
    { id: "view.mindmap", label: "Mind-map", shortcut: menuShortcut("view.mindmap"), group: "View", run: () => app.toggleMindMap() },
    {
      id: "view.readthrough",
      label: "Read-through",
      group: "View",
      disabled: !hasLibrary,
      run: () => app.toggleReadThrough(),
    },
    { id: "view.spell", label: "Spellcheck", group: "View", run: () => app.toggleSpellcheck() },
    { id: "view.focus", label: "Focus Mode", shortcut: menuShortcut("view.focus"), group: "View", run: () => app.toggleFocusMode() },
    {
      id: "view.author",
      label: "Writing Mode",
      group: "View",
      run: () => app.setMode("author"),
    },
    {
      id: "view.editor",
      label: "Review Mode",
      group: "View",
      run: () => app.setMode("editor"),
    },
    { id: "view.edits", label: "Show edits & comments", group: "View", run: () => app.toggleShowEdits() },

    // Settings
    { id: "settings.open", label: "Settings…", group: "Settings", run: () => app.openDialog("settings") },
    { id: "settings.shortcuts", label: "Keyboard shortcuts…", group: "Settings", run: () => app.openDialog("shortcuts") },
    { id: "settings.font", label: "Load Custom Font…", group: "Settings", run: () => void app.importCustomFont() },
  ];
}

export const MENU_STRUCTURE: { label: string; group: string; items?: string[] }[] = [
  {
    label: "File",
    group: "File",
    items: [
      "file.new",
      "file.open",
      "file.create",
      "file.save",
      "file.snapshots",
      "file.export.html",
      "file.export.md",
      "file.export.docx",
      "file.export.text",
      "file.close",
    ],
  },
  {
    label: "Edit",
    group: "Edit",
    items: ["edit.undo", "edit.redo", "edit.find", "edit.searchLibrary", "edit.palette", "edit.selectAll", "edit.rename", "edit.duplicate", "edit.delete"],
  },
  {
    label: "Insert",
    group: "Insert",
    items: ["insert.divider", "insert.scene", "insert.page", "insert.toc", "insert.image", "insert.table"],
  },
  {
    label: "Format",
    group: "Format",
    items: ["fmt.bold", "fmt.italic", "fmt.underline", "fmt.strike", "fmt.h2", "fmt.h3", "fmt.left", "fmt.center", "fmt.right", "fmt.justify", "fmt.clear"],
  },
  {
    label: "Review",
    group: "Review",
    items: ["review.comment", "review.track", "review.accept", "review.reject", "review.summary", "review.handoff", "review.panel"],
  },
  {
    label: "Book",
    group: "Book",
    items: ["book.settings", "book.compile", "book.compile.html", "book.compile.md", "book.compile.txt", "book.compile.docx"],
  },
  {
    label: "View",
    group: "View",
    items: ["view.sidebar", "view.split", "view.mindmap", "view.readthrough", "view.spell", "view.focus", "view.author", "view.editor", "view.edits"],
  },
  {
    label: "Settings",
    group: "Settings",
    items: ["settings.open", "settings.shortcuts", "settings.font"],
  },
];