import { chapterStore } from "$lib/stores/chapter.svelte";
import { fontStore } from "$lib/stores/fonts.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import {
  saveAppSettings,
  type AppSettings,
} from "$lib/utils/appSettings";

export interface AppSettingsHost {
  settings: AppSettings;
  sidebarWidth: number;
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
  host.spellcheck = next.spellcheck;
  void fontStore.ensureFont(next.defaultFontFamily);
  chapterStore.applyEditorStyles(
    next.spellcheck,
    next.defaultFontFamily,
    next.defaultFontSize,
  );
  if (!opts?.skipLibrarySync && libraryStore.library) {
    void libraryStore.syncPreferencesToBook(next);
  }
}