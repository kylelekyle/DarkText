import { invoke } from "@tauri-apps/api/core";
import type {
  BulkChapterComments,
  ChapterComments,
  ChapterSection,
  LibraryReviewSummary,
} from "$lib/types";

export async function readCommentsBulk(
  libraryPath: string,
  chapterIds: string[],
  section?: ChapterSection,
): Promise<BulkChapterComments[]> {
  return invoke("read_comments_bulk", { libraryPath, chapterIds, section });
}

export async function readChapterComments(
  libraryPath: string,
  chapterId: string,
  section?: ChapterSection,
): Promise<ChapterComments> {
  return invoke("read_chapter_comments", { libraryPath, chapterId, section });
}

export async function saveChapterComments(
  libraryPath: string,
  chapterId: string,
  data: ChapterComments,
  section?: ChapterSection,
): Promise<ChapterComments> {
  return invoke("save_chapter_comments", { libraryPath, chapterId, section, data });
}

export async function getLibraryReviewSummary(
  libraryPath: string,
): Promise<LibraryReviewSummary> {
  return invoke("get_library_review_summary", { libraryPath });
}

export async function stripReviewMarksHtml(html: string): Promise<string> {
  return invoke("strip_review_marks_html", { html });
}