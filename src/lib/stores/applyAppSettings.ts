import { chapterStore, splitChapterStore } from "$lib/stores/chapter.svelte";
import { fontStore } from "$lib/stores/fonts.svelte";
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
  host.settings = next;
  saveAppSettings(next);
  host.sidebarWidth = next.sidebarWidth;
  host.splitRatio = next.splitRatio;
  host.spellcheck = next.spellcheck;
  void fontStore.ensureFont(next.defaultFontFamily);
  const styleArgs = [
    next.spellcheck,
    next.defaultFontFamily,
    next.defaultFontSize,
  ] as const;
  chapterStore.applyEditorStyles(...styleArgs);
  splitChapterStore.applyEditorStyles(...styleArgs);
  if (!opts?.skipLibrarySync && libraryStore.library) {
    void libraryStore.syncPreferencesToBook(next);
  }
}