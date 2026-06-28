import { invoke } from "@tauri-apps/api/core";
import type { LibraryFont } from "$lib/types";

export async function listSystemFonts(): Promise<string[]> {
  return invoke("list_system_fonts");
}

export async function listLibraryFonts(libraryPath: string): Promise<LibraryFont[]> {
  return invoke("list_library_fonts", { libraryPath });
}

export async function importLibraryFont(
  libraryPath: string,
  sourcePath: string,
): Promise<LibraryFont> {
  return invoke("import_library_font", { libraryPath, sourcePath });
}