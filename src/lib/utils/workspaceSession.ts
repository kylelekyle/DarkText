import * as api from "$lib/api/library";
import { app } from "$lib/stores/app.svelte";
import { chapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import type { ChapterSection } from "$lib/types";

const KEY = "darktext-workspace-session";

const CHAPTER_SECTIONS = new Set<ChapterSection>([
  "chapters",
  "research",
  "characters",
]);

export interface WorkspaceSession {
  libraryPath: string;
  chapterId: string | null;
  section: ChapterSection;
}

/** Coerce persisted session data to a valid sidebar section. */
export function normalizeChapterSection(section: unknown): ChapterSection {
  if (
    typeof section === "string" &&
    CHAPTER_SECTIONS.has(section as ChapterSection)
  ) {
    return section as ChapterSection;
  }
  return "chapters";
}

export function clearWorkspaceSessionForLibrary(libraryPath: string): void {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as WorkspaceSession;
    if (session.libraryPath === libraryPath) {
      clearWorkspaceSession();
    }
  } catch {
    clearWorkspaceSession();
  }
}

export function clearWorkspaceSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private browsing */
  }
}

export function persistWorkspaceSession(): void {
  if (app.screen !== "workspace" || !libraryStore.library) {
    clearWorkspaceSession();
    return;
  }
  const session: WorkspaceSession = {
    libraryPath: libraryStore.library.path,
    chapterId: chapterStore.activeChapterId,
    section: chapterStore.activeSection,
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* quota / private browsing */
  }
}

export async function restoreWorkspaceSession(): Promise<void> {
  if (app.screen !== "welcome") return;

  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let session: WorkspaceSession;
  try {
    session = JSON.parse(raw) as WorkspaceSession;
  } catch {
    clearWorkspaceSession();
    return;
  }

  if (!session.libraryPath || typeof session.libraryPath !== "string") {
    clearWorkspaceSession();
    return;
  }

  session.section = normalizeChapterSection(session.section);
  if (session.chapterId !== null && typeof session.chapterId !== "string") {
    session.chapterId = null;
  }

  try {
    if (!(await api.isLibraryPath(session.libraryPath))) {
      clearWorkspaceSession();
      return;
    }
    await app.openLibrary(session.libraryPath);
    if (
      session.chapterId &&
      libraryStore.chapterExists(session.chapterId, session.section)
    ) {
      await app.openChapter(session.chapterId, session.section);
    }
    persistWorkspaceSession();
  } catch {
    clearWorkspaceSession();
  }
}