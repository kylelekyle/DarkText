import { invoke } from "@tauri-apps/api/core";
import type { ChapterSection, CompileOptions, ExportFormat, ExportResult } from "$lib/types";

export async function exportChapter(
  libraryPath: string,
  chapterId: string,
  format: ExportFormat,
  section: ChapterSection = "chapters",
): Promise<ExportResult> {
  return invoke("export_chapter", { libraryPath, chapterId, format, section });
}

export async function exportChapters(
  libraryPath: string,
  chapterIds: string[],
  format: ExportFormat,
  combined: boolean,
  outputDir?: string,
  filename?: string,
  style?: string,
  section: ChapterSection = "chapters",
): Promise<ExportResult> {
  return invoke("export_chapters", {
    libraryPath,
    chapterIds,
    format,
    options: {
      combined,
      outputDir,
      filename,
      style,
      section,
    },
  });
}

export async function compileBook(
  libraryPath: string,
  options: CompileOptions,
): Promise<ExportResult> {
  return invoke("compile_book", { libraryPath, options });
}

export async function getCompilePreview(libraryPath: string): Promise<string> {
  return invoke("get_compile_preview", { libraryPath });
}

export async function exportMarkedManuscript(
  libraryPath: string,
  outputDir?: string,
  filename?: string,
): Promise<ExportResult> {
  return invoke("export_marked_manuscript", { libraryPath, outputDir, filename });
}

export async function exportCommentsReport(
  libraryPath: string,
  outputDir?: string,
  filename?: string,
): Promise<ExportResult> {
  return invoke("export_comments_report", { libraryPath, outputDir, filename });
}