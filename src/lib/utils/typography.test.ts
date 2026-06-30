import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_SIZE,
  fontSizePtCss,
  migrateLegacyFontSizesInHtml,
  resolveFontSize,
} from "./typography";

describe("typography", () => {
  it("resolves stored sizes to plain point values", () => {
    expect(resolveFontSize("12")).toBe("12");
    expect(resolveFontSize("12pt")).toBe("12");
    expect(resolveFontSize("14pt")).toBe("14");
    expect(resolveFontSize("12px")).toBe("12");
    expect(resolveFontSize("bogus")).toBe(DEFAULT_FONT_SIZE);
    expect(resolveFontSize("10px")).toBe("10");
    expect(resolveFontSize("8px")).toBe("8");
  });

  it("builds pt CSS values for the editor", () => {
    expect(fontSizePtCss("12")).toBe("12pt");
    expect(fontSizePtCss("12pt")).toBe("12pt");
    expect(fontSizePtCss("12px")).toBe("12pt");
  });

  it("migrates legacy inline px font sizes in chapter HTML to pt", () => {
    const html =
      '<p><span style="font-size: 12px">Hello</span> <span style="font-size:14px">world</span></p>';
    expect(migrateLegacyFontSizesInHtml(html)).toBe(
      '<p><span style="font-size: 12pt">Hello</span> <span style="font-size: 14pt">world</span></p>',
    );
  });

  it("keeps inline pt font sizes unchanged", () => {
    const html = '<p><span style="font-size: 12pt">Hello</span></p>';
    expect(migrateLegacyFontSizesInHtml(html)).toBe(html);
  });
});