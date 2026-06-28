import { describe, expect, it } from "vitest";
import {
  EXPORT_PRESETS,
  applyExportPreset,
  outputHint,
  presetStyleFor,
} from "./exportPresets";

describe("exportPresets", () => {
  it("manuscript preset maps to docx", () => {
    expect(applyExportPreset("manuscript")).toEqual({
      format: "docx",
      style: "manuscript",
    });
  });

  it("ebook preset uses styled html label consistently", () => {
    const ebook = EXPORT_PRESETS.find((p) => p.value === "ebook");
    expect(ebook?.label).toBe("Styled HTML");
  });

  it("presetStyleFor custom returns default", () => {
    expect(presetStyleFor("custom")).toBe("default");
  });

  it("outputHint defaults to library exports path", () => {
    expect(outputHint("/books/MyNovel", "")).toBe("/books/MyNovel/exports");
    expect(outputHint(undefined, "/tmp/out")).toBe("/tmp/out");
  });
});