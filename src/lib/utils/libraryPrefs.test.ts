import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "./appSettings";
import { preferencesFromSettings, settingsFromPreferences } from "./libraryPrefs";

describe("libraryPrefs", () => {
  it("round-trips compile preferences", () => {
    const base = {
      ...defaultAppSettings,
      includeResearchInCompile: true,
      includeCharactersInCompile: false,
      defaultCompileFormat: "markdown" as const,
    };
    const prefs = preferencesFromSettings(base);
    const merged = settingsFromPreferences(prefs, defaultAppSettings);
    expect(merged.includeResearchInCompile).toBe(true);
    expect(merged.includeCharactersInCompile).toBe(false);
    expect(merged.defaultCompileFormat).toBe("markdown");
  });

  it("returns base when preferences undefined", () => {
    expect(settingsFromPreferences(undefined, defaultAppSettings)).toEqual(
      defaultAppSettings,
    );
  });

  it("migrates legacy pt defaultFontSize from library preferences", () => {
    const merged = settingsFromPreferences(
      { defaultFontSize: "12pt" },
      defaultAppSettings,
    );
    expect(merged.defaultFontSize).toBe("12");
  });
});