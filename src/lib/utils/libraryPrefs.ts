import type { AppSettings } from "$lib/utils/appSettings";
import type { LibraryPreferences } from "$lib/types";
import { resolveFontSize } from "$lib/utils/typography";

export function preferencesFromSettings(
  settings: AppSettings,
): LibraryPreferences {
  return {
    autoSaveMs: settings.autoSaveMs,
    defaultFontFamily: settings.defaultFontFamily,
    defaultFontSize: settings.defaultFontSize,
    defaultCompilePreset: settings.defaultCompilePreset,
    defaultCompileFormat: settings.defaultCompileFormat,
    includeResearchInCompile: settings.includeResearchInCompile,
    includeCharactersInCompile: settings.includeCharactersInCompile,
  };
}

export function settingsFromPreferences(
  prefs: LibraryPreferences | undefined,
  base: AppSettings,
): AppSettings {
  if (!prefs) return base;
  return {
    ...base,
    autoSaveMs: prefs.autoSaveMs ?? base.autoSaveMs,
    defaultFontFamily: prefs.defaultFontFamily ?? base.defaultFontFamily,
    defaultFontSize: resolveFontSize(
      prefs.defaultFontSize ?? base.defaultFontSize,
    ),
    defaultCompilePreset: prefs.defaultCompilePreset ?? base.defaultCompilePreset,
    defaultCompileFormat: prefs.defaultCompileFormat ?? base.defaultCompileFormat,
    includeResearchInCompile:
      prefs.includeResearchInCompile ?? base.includeResearchInCompile,
    includeCharactersInCompile:
      prefs.includeCharactersInCompile ?? base.includeCharactersInCompile,
  };
}