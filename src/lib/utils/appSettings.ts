import type { CompilePreset, ExportFormat } from "$lib/types";

const STORAGE_KEY = "darktext-settings";

const VALID_PRESETS: CompilePreset[] = ["manuscript", "ebook", "web", "custom"];
const VALID_FORMATS: ExportFormat[] = ["html", "markdown", "docx", "text", "epub"];

export interface AppSettings {
  autoSaveMs: number;
  confirmOnClose: boolean;
  openLastOnLaunch: boolean;
  installType: "portable" | "install" | null;
  firstRunComplete: boolean;
  defaultFontFamily: string;
  defaultFontSize: string;
  spellcheck: boolean;
  defaultCompilePreset: CompilePreset;
  defaultCompileFormat: ExportFormat;
  includeResearchInCompile: boolean;
  includeCharactersInCompile: boolean;
  defaultLibraryFolder: string;
  sidebarWidth: number;
  authorDisplayName: string;
  reviewerDisplayName: string;
}

export const defaultAppSettings: AppSettings = {
  autoSaveMs: 600,
  confirmOnClose: true,
  openLastOnLaunch: false,
  installType: null,
  firstRunComplete: false,
  defaultFontFamily: "Georgia, serif",
  defaultFontSize: "12pt",
  spellcheck: true,
  defaultCompilePreset: "manuscript",
  defaultCompileFormat: "docx",
  includeResearchInCompile: false,
  includeCharactersInCompile: false,
  defaultLibraryFolder: "",
  sidebarWidth: 260,
  authorDisplayName: "Author",
  reviewerDisplayName: "Editor",
};

export function normalizeAppSettings(raw: Partial<AppSettings>): AppSettings {
  const merged = { ...defaultAppSettings, ...raw };
  return {
    ...merged,
    autoSaveMs: Math.min(10_000, Math.max(200, Number(merged.autoSaveMs) || defaultAppSettings.autoSaveMs)),
    sidebarWidth: Math.min(480, Math.max(180, Number(merged.sidebarWidth) || defaultAppSettings.sidebarWidth)),
    spellcheck: merged.spellcheck !== false,
    defaultCompilePreset: VALID_PRESETS.includes(merged.defaultCompilePreset)
      ? merged.defaultCompilePreset
      : defaultAppSettings.defaultCompilePreset,
    defaultCompileFormat: VALID_FORMATS.includes(merged.defaultCompileFormat)
      ? merged.defaultCompileFormat
      : defaultAppSettings.defaultCompileFormat,
    authorDisplayName:
      merged.authorDisplayName?.trim() || defaultAppSettings.authorDisplayName,
    reviewerDisplayName:
      merged.reviewerDisplayName?.trim() || defaultAppSettings.reviewerDisplayName,
  };
}

export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem("darktext-prefs");
      if (legacy) {
        const p = JSON.parse(legacy) as Partial<AppSettings>;
        return normalizeAppSettings(p);
      }
      return { ...defaultAppSettings };
    }
    return normalizeAppSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return { ...defaultAppSettings };
  }
}

export function saveAppSettings(settings: AppSettings) {
  const normalized = normalizeAppSettings(settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem(
    "darktext-prefs",
    JSON.stringify({
      installType: normalized.installType,
      firstRunComplete: normalized.firstRunComplete,
      openLastOnLaunch: normalized.openLastOnLaunch,
    }),
  );
}