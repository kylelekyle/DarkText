import * as api from "$lib/api/library";
import { getAppSettings, saveAppSettings } from "./appSettings";
import { isTauriRuntime } from "./platform";

const STORAGE_KEY = "darktext-recent-libraries";
const MAX_RECENT = 6;

export interface AppPrefs {
  installType: "portable" | "install" | null;
  firstRunComplete: boolean;
  openLastOnLaunch: boolean;
}

export function getPrefs(): AppPrefs {
  const s = getAppSettings();
  return {
    installType: s.installType,
    firstRunComplete: s.firstRunComplete,
    openLastOnLaunch: s.openLastOnLaunch,
  };
}

export function savePrefs(prefs: AppPrefs) {
  const s = getAppSettings();
  saveAppSettings({ ...s, ...prefs });
}

export function getRecentLibraries(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as string[];
    return Array.isArray(list) ? list.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function saveRecentLibraries(paths: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths.slice(0, MAX_RECENT)));
}

/** Drop paths that fail the validity check; order is preserved. */
export function pruneRecentLibraryList(
  paths: string[],
  isValid: (path: string) => boolean,
): string[] {
  return paths.filter(isValid).slice(0, MAX_RECENT);
}

export function getLastLibrary(): string | null {
  const recent = getRecentLibraries();
  return recent[0] ?? null;
}

export function addRecentLibrary(path: string) {
  const existing = getRecentLibraries().filter((p) => p !== path);
  const next = [path, ...existing].slice(0, MAX_RECENT);
  saveRecentLibraries(next);
}

export function removeRecentLibrary(path: string) {
  const next = getRecentLibraries().filter((p) => p !== path);
  saveRecentLibraries(next);
}

/** Remove missing or invalid libraries from storage and return the kept list. */
export async function refreshRecentLibraries(): Promise<string[]> {
  const stored = getRecentLibraries();
  if (stored.length === 0) return [];

  if (!isTauriRuntime()) return stored;

  const valid: string[] = [];
  for (const path of stored) {
    try {
      if (await api.isLibraryPath(path)) valid.push(path);
    } catch {
      /* path missing or unreadable */
    }
  }

  if (valid.length !== stored.length) saveRecentLibraries(valid);
  return valid;
}