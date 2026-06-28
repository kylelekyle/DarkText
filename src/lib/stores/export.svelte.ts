import * as api from "$lib/api";
import {
  isDocxExport,
  isEpubExport,
  isRustExport,
  normalizeRustExportFormat,
} from "$lib/export/router";
import {
  chapterMetaForExport,
  chapterMetasForExport,
} from "$lib/export/resolveExportMeta";
import { libraryStore } from "$lib/stores/library.svelte";
import { chapterStore } from "$lib/stores/chapter.svelte";
import type {
  ChapterSection,
  CompileOptions,
  ExportFormat,
  ExportResult,
} from "$lib/types";

export class ExportStore {
  compileFormat = $state<ExportFormat | null>(null);
  exportFormat = $state<ExportFormat | null>(null);

  async compileBook(options: CompileOptions): Promise<ExportResult> {
    if (!libraryStore.library) throw new Error("No library open");
    await chapterStore.flushSave();
    if (isDocxExport(options.format)) {
      const { compileBookAsDocx } = await import("$lib/export/docxExport");
      return compileBookAsDocx(
        libraryStore.library.path,
        options,
        libraryStore.bookSettings,
      );
    }
    if (isEpubExport(options.format)) {
      const { compileBookAsEpub } = await import("$lib/export/epubExport");
      return compileBookAsEpub(
        libraryStore.library.path,
        options,
        libraryStore.bookSettings,
      );
    }
    return api.compileBook(libraryStore.library.path, options);
  }

  async exportChapter(format: ExportFormat): Promise<ExportResult> {
    if (!libraryStore.library || !chapterStore.activeChapterId) {
      throw new Error("No chapter selected");
    }
    const section = chapterStore.activeSection;
    const chapterId = chapterStore.activeChapterId;
    await chapterStore.flushSave();
    if (isDocxExport(format)) {
      const { exportChaptersAsDocx, loadChaptersForExport } = await import(
        "$lib/export/docxExport"
      );
      const meta = chapterMetaForExport(chapterId, section);
      if (!meta) throw new Error("Chapter not found");
      const chapters = await loadChaptersForExport(
        libraryStore.library.path,
        [meta],
        section,
      );
      return exportChaptersAsDocx(libraryStore.library.path, chapters, {
        combined: true,
        style: "default",
      });
    }
    if (!isRustExport(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }
    return api.exportChapter(
      libraryStore.library.path,
      chapterId,
      normalizeRustExportFormat(format),
      section,
    );
  }

  async exportChapters(
    chapterIds: string[],
    format: ExportFormat,
    combined: boolean,
    outputDir?: string,
    filename?: string,
    style?: string,
    section: ChapterSection = "chapters",
  ): Promise<ExportResult> {
    if (!libraryStore.library) throw new Error("No library open");
    if (chapterIds.length === 0) throw new Error("No chapters selected");
    await chapterStore.flushSave();
    if (isDocxExport(format)) {
      const { exportChaptersAsDocx, loadChaptersForExport } = await import(
        "$lib/export/docxExport"
      );
      const metas = chapterMetasForExport(chapterIds, section);
      if (metas.length === 0) throw new Error("Chapter not found");
      const chapters = await loadChaptersForExport(
        libraryStore.library.path,
        metas,
        section,
      );
      return exportChaptersAsDocx(libraryStore.library.path, chapters, {
        combined,
        outputDir,
        filename,
        style: style as import("$lib/types").CompilePreset | "default" | undefined,
      });
    }
    if (!isRustExport(format)) {
      throw new Error(`Unsupported export format: ${format}`);
    }
    return api.exportChapters(
      libraryStore.library.path,
      chapterIds,
      normalizeRustExportFormat(format),
      combined,
      outputDir,
      filename,
      style,
      section,
    );
  }
}

export const exportStore = new ExportStore();