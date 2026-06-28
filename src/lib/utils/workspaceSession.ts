import * as api from "$lib/api/library";
import { app } from "$lib/stores/app.svelte";
import { chapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import type { ChapterSection } from "$lib/types";

const KEY = "darktext-workspace-session";

export interface WorkspaceSession {
  libraryPath: string;
  chapterId: string | null;
  section: ChapterSection;
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

  if (!session.libraryPath) {
    clearWorkspaceSession();
    return;
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