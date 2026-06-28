import { invoke } from "@tauri-apps/api/core";
import type { BookSettings, LibraryManifest } from "$lib/types";

export async function createLibrary(
  path: string,
  name: string,
): Promise<LibraryManifest> {
  return invoke("create_library", { path, name });
}

export async function openLibrary(path: string): Promise<LibraryManifest> {
  return invoke("open_library", { path });
}

export async function isLibraryPath(path: string): Promise<boolean> {
  return invoke("is_library_path", { path });
}

export async function trashLibraryFolder(path: string): Promise<void> {
  return invoke("trash_library_folder", { path });
}

export async function closeLibrary(): Promise<void> {
  return invoke("close_library");
}

export async function saveLibraryManifest(
  manifest: LibraryManifest,
): Promise<LibraryManifest> {
  return invoke("save_library_manifest", { manifest });
}

export async function getBookSettings(
  libraryPath: string,
): Promise<BookSettings> {
  return invoke("get_book_settings", { libraryPath });
}

export async function saveBookSettings(
  libraryPath: string,
  settings: BookSettings,
): Promise<BookSettings> {
  return invoke("save_book_settings", { libraryPath, settings });
}