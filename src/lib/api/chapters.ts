import { invoke } from "@tauri-apps/api/core";
import type {
  ChapterContent,
  ChapterMeta,
  ChapterSection,
  ChapterSnapshot,
  ChapterStatus,
  LibraryManifest,
} from "$lib/types";

export async function createChapter(
  libraryPath: string,
  title?: string,
  section?: ChapterSection,
): Promise<ChapterContent> {
  return invoke("create_chapter", { libraryPath, title, section });
}

export async function readChapter(
  libraryPath: string,
  chapterId: string,
  section?: ChapterSection,
): Promise<ChapterContent> {
  return invoke("read_chapter", { libraryPath, chapterId, section });
}

export async function readChaptersBulk(
  libraryPath: string,
  chapterIds: string[],
  section?: ChapterSection,
): Promise<ChapterContent[]> {
  return invoke("read_chapters_bulk", { libraryPath, chapterIds, section });
}

export async function saveChapter(
  libraryPath: string,
  meta: ChapterMeta,
  html: string,
  section?: ChapterSection,
): Promise<ChapterMeta> {
  return invoke("save_chapter", { libraryPath, meta, html, section });
}

export async function updateChapterStatus(
  libraryPath: string,
  chapterId: string,
  status: ChapterStatus,
  section?: ChapterSection,
): Promise<ChapterMeta> {
  return invoke("update_chapter_status", {
    libraryPath,
    chapterId,
    status,
    section,
  });
}

export async function updateChapterTitle(
  libraryPath: string,
  chapterId: string,
  title: string,
  section?: ChapterSection,
): Promise<ChapterMeta> {
  return invoke("update_chapter_title", {
    libraryPath,
    chapterId,
    title,
    section,
  });
}

export async function reorderChapters(
  libraryPath: string,
  chapterIds: string[],
  section?: ChapterSection,
): Promise<LibraryManifest> {
  return invoke("reorder_chapters", { libraryPath, chapterIds, section });
}

export async function listResearchChapters(
  libraryPath: string,
): Promise<ChapterMeta[]> {
  return invoke("list_research_chapters", { libraryPath });
}

export async function listCharacterChapters(
  libraryPath: string,
): Promise<ChapterMeta[]> {
  return invoke("list_character_chapters", { libraryPath });
}

export async function getCompileChapters(
  libraryPath: string,
): Promise<ChapterMeta[]> {
  return invoke("get_compile_chapters", { libraryPath });
}

export async function deleteChapter(
  libraryPath: string,
  chapterId: string,
  section?: ChapterSection,
): Promise<LibraryManifest> {
  return invoke("delete_chapter", { libraryPath, chapterId, section });
}

export async function duplicateChapter(
  libraryPath: string,
  chapterId: string,
  section?: ChapterSection,
): Promise<ChapterContent> {
  return invoke("duplicate_chapter", { libraryPath, chapterId, section });
}

export async function saveChapterSnapshot(
  libraryPath: string,
  chapterId: string,
  section?: ChapterSection,
): Promise<ChapterSnapshot> {
  return invoke("save_chapter_snapshot", { libraryPath, chapterId, section });
}

export async function listChapterSnapshots(
  libraryPath: string,
  chapterId: string,
  section?: ChapterSection,
): Promise<ChapterSnapshot[]> {
  return invoke("list_chapter_snapshots", { libraryPath, chapterId, section });
}

export async function restoreChapterSnapshot(
  libraryPath: string,
  chapterId: string,
  snapshotId: string,
  section?: ChapterSection,
): Promise<ChapterContent> {
  return invoke("restore_chapter_snapshot", {
    libraryPath,
    chapterId,
    snapshotId,
    section,
  });
}