import * as api from "$lib/api";
import type { BookSettings, ChapterMeta, CompileOptions, CompilePreset, ExportResult } from "$lib/types";
import { buildDocxBlob } from "./htmlToDocx";
import { loadChaptersBulk, stripForPublish } from "./pipeline";
import { sanitizeFilename } from "./sanitize";
import { writeExportBytes } from "./writeExport";

function resolveStyle(preset?: CompilePreset | "default"): CompilePreset | "default" {
  if (!preset || preset === "custom") return "default";
  return preset;
}

async function resolveDocxFilename(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "export.docx";
  if (trimmed.toLowerCase().endsWith(".docx")) {
    const stem = trimmed.slice(0, -".docx".length);
    return `${await sanitizeFilename(stem)}.docx`;
  }
  return `${await sanitizeFilename(trimmed)}.docx`;
}

async function blobToResult(
  libraryPath: string,
  filename: string,
  blob: Blob,
  outputDir: string | undefined,
  preview: string,
): Promise<ExportResult> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const result = await writeExportBytes(libraryPath, filename, bytes, outputDir);
  return { ...result, preview };
}

export async function exportChaptersAsDocx(
  libraryPath: string,
  chapters: { meta: ChapterMeta; html: string }[],
  options: {
    combined: boolean;
    outputDir?: string;
    filename?: string;
    style?: CompilePreset | "default";
  },
): Promise<ExportResult> {
  const style = resolveStyle(options.style);
  const stamp = new Date().toISOString().slice(0, 10);
  const cleanSections = await Promise.all(
    chapters.map(async (c) => ({
      title: c.meta.title,
      html: await stripForPublish(c.html),
    })),
  );

  if (options.combined || chapters.length === 1) {
    const meta = chapters[0]?.meta;
    const base =
      options.filename?.trim() ||
      (chapters.length === 1
        ? `${await sanitizeFilename(meta?.title ?? "chapter")}.docx`
        : `export-${stamp}.docx`);
    const filename = await resolveDocxFilename(base);
    const blob = await buildDocxBlob(cleanSections, {}, style, libraryPath);
    const preview = chapters.map((c) => c.meta.title).join(", ");
    return blobToResult(libraryPath, filename, blob, options.outputDir, preview);
  }

  let lastPath = "";
  for (const ch of cleanSections) {
    const base = `${await sanitizeFilename(ch.title ?? "chapter")}-${stamp}`;
    const blob = await buildDocxBlob([ch], {}, style, libraryPath);
    const res = await blobToResult(
      libraryPath,
      `${base}.docx`,
      blob,
      options.outputDir,
      ch.title ?? "",
    );
    lastPath = res.path;
  }
  return { path: lastPath, format: "docx", preview: `${chapters.length} files exported` };
}

export async function compileBookAsDocx(
  libraryPath: string,
  options: CompileOptions,
  bookSettings: BookSettings,
): Promise<ExportResult> {
  const finals = await api.getCompileChapters(libraryPath);
  if (finals.length === 0) {
    throw new Error("No Final chapters to compile. Mark chapters as Final in the sidebar.");
  }

  const loaded = await loadChaptersBulk(libraryPath, finals, "chapters");
  const sections: { title?: string; html: string }[] = await Promise.all(
    loaded.map(async (c) => ({
      title: c.meta.title,
      html: await stripForPublish(c.html),
    })),
  );

  if (options.includeResearch) {
    const research = await api.listResearchChapters(libraryPath);
    if (research.length > 0) {
      sections.push({ title: "Research Notes", html: "" });
      const notes = await loadChaptersBulk(libraryPath, research, "research");
      for (const note of notes) {
        sections.push({
          title: note.meta.title,
          html: await stripForPublish(note.html),
        });
      }
    }
  }

  if (options.includeCharacters) {
    const characters = await api.listCharacterChapters(libraryPath);
    if (characters.length > 0) {
      sections.push({ title: "Cast of Characters", html: "" });
      const sheets = await loadChaptersBulk(libraryPath, characters, "characters");
      for (const sheet of sheets) {
        sections.push({
          title: sheet.meta.title,
          html: await stripForPublish(sheet.html),
        });
      }
    }
  }

  const style = resolveStyle(options.style);
  const title = bookSettings.title.trim();
  const author = bookSettings.author.trim();
  const base =
    options.filename?.trim() ||
    `${await sanitizeFilename(title || "book")}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.docx`;
  const filename = await resolveDocxFilename(base);

  const blob = await buildDocxBlob(
    sections,
    {
      title: bookSettings.includeFrontMatter && title ? title : undefined,
      author: bookSettings.includeFrontMatter && author ? author : undefined,
    },
    style,
    libraryPath,
  );

  const preview = finals.map((c) => c.title).join(", ");
  return blobToResult(libraryPath, filename, blob, options.outputDir, preview);
}

export async function loadChaptersForExport(
  libraryPath: string,
  metas: ChapterMeta[],
  section: import("$lib/types").ChapterSection = "chapters",
): Promise<{ meta: ChapterMeta; html: string }[]> {
  if (!metas.length) throw new Error("No chapters selected");
  const loaded = await loadChaptersBulk(libraryPath, metas, section);
  return loaded.map((c) => ({ meta: c.meta, html: c.html }));
}