export type ChapterStatus = "draft" | "needs-refine" | "final";
export type AppMode = "author" | "editor";
export type AppScreen = "welcome" | "workspace";
export type ChapterSection = "chapters" | "research" | "characters";
export type SidebarTab = "chapters" | "research" | "characters";
export type ActiveDialog =
  | null
  | "bookSettings"
  | "compile"
  | "findReplace"
  | "globalSearch"
  | "exportChapter"
  | "editorHandoff"
  | "libraryReview"
  | "settings"
  | "shortcuts"
  | "renameChapter"
  | "addComment"
  | "chapterSnapshots";

export interface ChapterSnapshot {
  id: string;
  createdAt: string;
  title: string;
  wordCount: number;
  charCount: number;
}

export interface LibraryImageInfo {
  relativePath: string;
  path: string;
  filename: string;
}

export interface LibrarySearchHit {
  chapterId: string;
  section: ChapterSection;
  title: string;
  excerpt: string;
  matchIndex: number;
}

export interface ChapterReviewSummary {
  chapterId: string;
  section: ChapterSection;
  title: string;
  openComments: number;
  pendingChanges: number;
}

export interface LibraryReviewSummary {
  totalOpenComments: number;
  totalPendingChanges: number;
  chapters: ChapterReviewSummary[];
}

export interface SearchJumpTarget {
  chapterId: string;
  section: ChapterSection;
  query: string;
  matchIndex?: number;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export type ExportFormat = "html" | "markdown" | "text" | "docx" | "epub";

export type CompilePreset = "custom" | "manuscript" | "ebook" | "web";

export interface CompileOptions {
  format: ExportFormat;
  includeResearch?: boolean;
  includeCharacters?: boolean;
  filename?: string;
  outputDir?: string;
  style?: CompilePreset | "default";
}

export interface ExportBatchOptions {
  format: ExportFormat;
  combined: boolean;
  outputDir?: string;
  filename?: string;
  style?: CompilePreset | "default";
}

export type ChangeStatus = "pending" | "accepted" | "rejected";
export type ChangeType = "insertion" | "deletion";

/** Word-style markup display modes for the review editor. */
export type MarkupMode = "simple" | "all" | "none" | "original";

export interface ChapterMeta {
  id: string;
  title: string;
  status: ChapterStatus;
  order: number;
  updatedAt: string;
  wordCount?: number;
  charCount?: number;
}

export interface LibraryManifest {
  name: string;
  version: number;
  path: string;
  chapters: ChapterMeta[];
}

export interface ChapterContent {
  meta: ChapterMeta;
  html: string;
  section: ChapterSection;
}

export interface LibraryPreferences {
  autoSaveMs?: number;
  defaultFontSize?: string;
  defaultCompilePreset?: CompilePreset;
  defaultCompileFormat?: ExportFormat;
  includeResearchInCompile?: boolean;
  includeCharactersInCompile?: boolean;
  /** Compile dialog chapter list — default true when omitted */
  compileShowChapterNumbers?: boolean;
  compileShowChapterTitles?: boolean;
}

export interface BookSettings {
  title: string;
  author: string;
  includeFrontMatter: boolean;
  includeBackMatter: boolean;
  wordGoal: number;
  preferences?: LibraryPreferences;
}

export interface ChapterStats {
  words: number;
  chars: number;
}

export type FontSource = "system" | "custom";

export interface FontOption {
  family: string;
  label: string;
  cssValue: string;
  source: FontSource;
  path?: string;
}

export interface LibraryFont {
  family: string;
  filename: string;
  path: string;
}

export interface ExportResult {
  path: string;
  format: string;
  preview: string;
}

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  markId: string;
  anchorText: string;
  resolved: boolean;
  replies: CommentReply[];
}

export interface TrackedChange {
  id: string;
  markId: string;
  type: ChangeType;
  text: string;
  status: ChangeStatus;
  createdAt: string;
  /** Display name of whoever made the change (optional for legacy sidecars). */
  author?: string;
}

export interface ChapterComments {
  threads: CommentThread[];
  changes: TrackedChange[];
}

export interface MindMapNodeRef {
  id: string;
  section: ChapterSection;
}

export interface MindMapNodePos {
  x: number;
  y: number;
  pinned: boolean;
}

export interface MindMapLink {
  id: string;
  from: MindMapNodeRef;
  to: MindMapNodeRef;
}

export interface MindMapViewState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface MindMapData {
  version: number;
  globalPinned: boolean;
  nodes: Record<string, MindMapNodePos>;
  links: MindMapLink[];
  view: MindMapViewState;
}

export interface MindMapNode {
  key: string;
  id: string;
  section: ChapterSection;
  title: string;
  status: ChapterStatus;
  x: number;
  y: number;
  pinned: boolean;
}

export interface MenuAction {
  id: string;
  label: string;
  shortcut?: string;
  group?: string;
  disabled?: boolean;
  submenu?: MenuAction[];
  run?: () => void;
}

export interface BulkChapterComments {
  chapterId: string;
  section: ChapterSection;
  comments: ChapterComments;
}