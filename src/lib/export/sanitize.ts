import * as api from "$lib/api";
import { isTauriRuntime } from "$lib/utils/platform";

/** Local fallback — kept in sync with Rust compile::sanitize_filename. */
export function sanitizeFilenameLocal(title: string): string {
  return title
    .split("")
    .map((c) => (/[a-zA-Z0-9_-]/.test(c) ? c : "_"))
    .join("")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "export";
}

/** Prefer Rust as source of truth when running inside Tauri. */
export async function sanitizeFilename(title: string): Promise<string> {
  if (isTauriRuntime()) {
    return api.sanitizeFilenameTitle(title);
  }
  return sanitizeFilenameLocal(title);
}