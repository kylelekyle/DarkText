import { invoke } from "@tauri-apps/api/core";
import type { ExportResult } from "$lib/types";

export async function writeExportBytes(
  libraryPath: string,
  filename: string,
  bytes: Uint8Array,
  outputDir?: string,
): Promise<ExportResult> {
  try {
    return await invoke<ExportResult>("write_export_bytes", {
      libraryPath,
      filename,
      bytes,
      outputDir: outputDir?.trim() || undefined,
    });
  } catch (e) {
    console.error("Export failed:", e);
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(message);
  }
}
