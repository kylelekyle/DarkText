import { invoke } from "@tauri-apps/api/core";
import type { LibrarySearchHit } from "$lib/types";

export async function searchLibrary(
  libraryPath: string,
  query: string,
  limit?: number,
): Promise<LibrarySearchHit[]> {
  return invoke("search_library", { libraryPath, query, limit });
}