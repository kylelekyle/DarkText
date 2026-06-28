import type { ExportFormat } from "$lib/types";

/** Formats handled by Rust `export_cmds` (html, markdown, text). */
export const RUST_EXPORT_FORMATS = ["html", "markdown", "text"] as const satisfies readonly ExportFormat[];

export type RustExportFormat = (typeof RUST_EXPORT_FORMATS)[number];

export function isDocxExport(format: ExportFormat): boolean {
  return format === "docx";
}

export function isEpubExport(format: ExportFormat): boolean {
  return format === "epub";
}

export function isRustExport(format: ExportFormat): format is RustExportFormat {
  return (RUST_EXPORT_FORMATS as readonly string[]).includes(format);
}

export function isJsCompileExport(format: ExportFormat): boolean {
  return isDocxExport(format) || isEpubExport(format);
}

/** Pass-through for Rust IPC (ExportFormat already uses canonical names). */
export function normalizeRustExportFormat(format: ExportFormat): ExportFormat {
  return format;
}