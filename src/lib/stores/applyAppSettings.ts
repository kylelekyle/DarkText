import { chapterStore, splitChapterStore } from "$lib/stores/chapter.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import {
  saveAppSettings,
  type AppSettings,
} from "$lib/utils/appSettings";

export interface AppSettingsHost {
  settings: AppSettings;
  sidebarWidth: number;
  splitRatio: number;
  spellcheck: boolean;
}

export function applyAppSettings(
  host: AppSettingsHost,
  next: AppSettings,
  opts?: { skipLibrarySync?: boolean },
): void {
  const prev = host.settings;
  host.settings = next;
  saveAppSettings(next);
  host.sidebarWidth = next.sidebarWidth;
  host.splitRatio = next.splitRatio;
  host.spellcheck = next.spellcheck;
  if (
    prev.spellcheck !== next.spellcheck ||
    prev.defaultFontSize !== next.defaultFontSize
  ) {
    chapterStore.applyEditorStyles(next.spellcheck, next.defaultFontSize);
    splitChapterStore.applyEditorStyles(next.spellcheck, next.defaultFontSize);
  }
  if (!opts?.skipLibrarySync && libraryStore.library) {
    void libraryStore.syncPreferencesToBook(next);
  }
}