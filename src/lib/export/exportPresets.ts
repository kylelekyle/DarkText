import type { CompilePreset, ExportFormat } from "$lib/types";

export type ExportPresetId = CompilePreset;

export interface ExportPresetDef {
  value: ExportPresetId;
  label: string;
  desc: string;
  format: ExportFormat;
  style: CompilePreset | "default";
}

export const EXPORT_PRESETS: ExportPresetDef[] = [
  {
    value: "manuscript",
    label: "Manuscript for Editor",
    desc: "Word doc, clean formatting",
    format: "docx",
    style: "manuscript",
  },
  {
    value: "ebook",
    label: "Styled HTML",
    desc: "Web-ready HTML (not EPUB)",
    format: "html",
    style: "ebook",
  },
  {
    value: "web",
    label: "Web Preview",
    desc: "Single styled HTML file",
    format: "html",
    style: "default",
  },
  {
    value: "custom",
    label: "Custom",
    desc: "Choose format and options",
    format: "html",
    style: "default",
  },
];

export const EXPORT_FORMATS: { value: ExportFormat; label: string; note?: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "html", label: "HTML" },
  { value: "docx", label: "Word (.docx)", note: "Built-in" },
  { value: "text", label: "Plain Text" },
];

/** Formats offered in the Compile Book dialog. */
export const COMPILE_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "docx", label: "Word (.docx)" },
  { value: "epub", label: "EPUB (.epub)" },
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Plain Text" },
];

export function applyExportPreset(preset: ExportPresetId): {
  format: ExportFormat;
  style: CompilePreset | "default";
} {
  const match = EXPORT_PRESETS.find((p) => p.value === preset);
  if (!match || preset === "custom") {
    return { format: "html", style: "default" };
  }
  return { format: match.format, style: match.style };
}

export function presetStyleFor(preset: ExportPresetId): CompilePreset | "default" {
  return applyExportPreset(preset).style;
}

export function outputHint(libraryPath: string | undefined, outputDir: string): string {
  return outputDir.trim() || (libraryPath ? `${libraryPath}/exports` : "Library/exports");
}