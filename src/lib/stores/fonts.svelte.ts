import { convertFileSrc } from "@tauri-apps/api/core";
import * as api from "$lib/api";
import type { FontOption } from "$lib/types";
import { fontCssValue, fontOptionLabel } from "$lib/utils/fontFamily";

const REFRESH_MS = 120_000;
const loadedCustom = new Set<string>();

class FontStore {
  systemFamilies = $state<string[]>([]);
  customFonts = $state<FontOption[]>([]);
  loading = $state(false);
  lastRefresh = $state(0);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private libraryPath: string | null = null;

  get options(): FontOption[] {
    const system: FontOption[] = this.systemFamilies.map((family) => ({
      family,
      label: fontOptionLabel(family, "system"),
      cssValue: fontCssValue(family),
      source: "system",
    }));
    return [...this.customFonts, ...system];
  }

  get groupedOptions(): { label: string; options: FontOption[] }[] {
    const groups: { label: string; options: FontOption[] }[] = [];
    if (this.customFonts.length > 0) {
      groups.push({ label: "Library fonts", options: this.customFonts });
    }
    if (this.systemFamilies.length > 0) {
      groups.push({
        label: "System fonts",
        options: this.systemFamilies.map((family) => ({
          family,
          label: family,
          cssValue: fontCssValue(family),
          source: "system" as const,
        })),
      });
    }
    return groups;
  }

  async init() {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.refresh();
    });
    this.refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") void this.refresh();
    }, REFRESH_MS);
    await this.refreshSystem();
  }

  destroy() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  setLibraryPath(path: string | null) {
    this.libraryPath = path;
    if (path) void this.refreshLibrary(path);
    else {
      this.customFonts = [];
      loadedCustom.clear();
    }
  }

  async refresh() {
    await this.refreshSystem();
    if (this.libraryPath) await this.refreshLibrary(this.libraryPath);
  }

  async refreshSystem() {
    if (this.loading) return;
    this.loading = true;
    try {
      const families = await api.listSystemFonts();
      if (families.length > 0) {
        this.systemFamilies = families;
        this.lastRefresh = Date.now();
      }
    } catch {
      if (this.systemFamilies.length === 0) {
        this.systemFamilies = ["Georgia", "Times New Roman", "Garamond", "Arial", "Segoe UI"];
      }
    } finally {
      this.loading = false;
    }
  }

  async refreshLibrary(libraryPath?: string) {
    const path = libraryPath ?? this.libraryPath;
    if (!path) return;
    try {
      const fonts = await api.listLibraryFonts(path);
      const options: FontOption[] = [];
      for (const font of fonts) {
        const cssValue = fontCssValue(font.family);
        options.push({
          family: font.family,
          label: fontOptionLabel(font.family, "custom"),
          cssValue,
          source: "custom",
          path: font.path,
        });
        await this.registerCustomFont(font.family, font.path);
      }
      this.customFonts = options;
    } catch {
      this.customFonts = [];
    }
  }

  async registerCustomFont(family: string, filePath: string): Promise<boolean> {
    const key = `${family}::${filePath}`;
    if (loadedCustom.has(key)) return true;
    try {
      const url = convertFileSrc(filePath);
      const face = new FontFace(family, `url("${url}")`);
      await face.load();
      document.fonts.add(face);
      loadedCustom.add(key);
      return true;
    } catch {
      return false;
    }
  }

  findOption(cssValue: string): FontOption | undefined {
    const normalized = cssValue.trim().toLowerCase();
    return this.options.find((o) => o.cssValue.toLowerCase() === normalized);
  }

  async ensureFont(cssValue: string): Promise<boolean> {
    const match = this.findOption(cssValue);
    if (match?.source === "custom" && match.path) {
      return this.registerCustomFont(match.family, match.path);
    }
    try {
      return document.fonts.check(`16px ${cssValue}`);
    } catch {
      return true;
    }
  }
}

export const fontStore = new FontStore();