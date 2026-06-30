// Combined from: fontFamily.ts, fontSizes.ts

/** CSS font-family value for a given family name. */
export function fontCssValue(family: string, fallback = "serif"): string {
  const trimmed = family.trim();
  if (!trimmed) return fallback;
  const needsQuotes = /\s/.test(trimmed) || trimmed.includes(",");
  const quoted = needsQuotes && !trimmed.startsWith('"') ? `"${trimmed}"` : trimmed;
  return `${quoted}, ${fallback}`;
}

/** Parse the primary family name from a stored css font-family value. */
export function primaryFamily(cssValue: string): string {
  const first = cssValue.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}

/** Check whether the browser can render a font family. */
export function isFontAvailable(cssValue: string): boolean {
  try {
    return document.fonts.check(`16px ${cssValue}`);
  } catch {
    return false;
  }
}

export function fontOptionLabel(family: string, source: "system" | "custom"): string {
  return source === "custom" ? `${family} (Library)` : family;
}

/** Stored settings / toolbar values are plain point numbers (e.g. "12"). */
export const DEFAULT_FONT_SIZE = "12";

/** Editor toolbar / settings sizes in points. */
export const FONT_SIZES = [
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "16",
  "18",
  "20",
  "24",
  "28",
  "32",
  "36",
] as const;

export function fontSizeLabel(size: string): string {
  return size.replace(/pt$/i, "").replace(/px$/i, "");
}

/** CSS font-size value for editor HTML (always points). */
export function fontSizePtCss(size: string): string {
  return `${fontSizeLabel(resolveFontSize(size))}pt`;
}

/** Normalize stored settings to a valid toolbar value (plain points). */
export function resolveFontSize(size: string): string {
  const trimmed = size.trim();
  if ((FONT_SIZES as readonly string[]).includes(trimmed)) return trimmed;
  const match = /^([\d.]+)\s*(pt|px)?$/i.exec(trimmed);
  if (match) {
    const n = match[1];
    if ((FONT_SIZES as readonly string[]).includes(n)) return n;
  }
  return DEFAULT_FONT_SIZE;
}

/** Rewrite legacy inline `font-size: Npx` styles in chapter HTML to points. */
export function migrateLegacyFontSizesInHtml(html: string): string {
  return html.replace(/font-size:\s*([\d.]+)\s*px/gi, (_, n: string) => `font-size: ${n}pt`);
}