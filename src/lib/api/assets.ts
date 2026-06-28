import { invoke } from "@tauri-apps/api/core";
import type { LibraryImageInfo } from "$lib/types";

export async function sanitizeFilenameTitle(title: string): Promise<string> {
  return invoke("sanitize_filename_title", { title });
}

export async function readFileBytes(
  libraryPath: string,
  path: string,
): Promise<Uint8Array> {
  const bytes = await invoke<number[] | Uint8Array>("read_file_bytes", {
    libraryPath,
    path,
  });
  return bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
}

export async function importLibraryImage(
  libraryPath: string,
  sourcePath: string,
): Promise<LibraryImageInfo> {
  return invoke("import_library_image", { libraryPath, sourcePath });
}