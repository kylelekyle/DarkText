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

/** Word-processor-style point sizes for the toolbar dropdown. */
export const FONT_SIZES = [
  "9pt",
  "10pt",
  "11pt",
  "12pt",
  "13pt",
  "14pt",
  "16pt",
  "18pt",
  "20pt",
  "24pt",
  "28pt",
  "32pt",
  "36pt",
] as const;

export function fontSizeLabel(size: string): string {
  return size.replace(/pt$/, "").replace(/px$/, "");
}

/** Normalize stored settings to a valid dropdown value. */
export function resolveFontSize(size: string): string {
  if ((FONT_SIZES as readonly string[]).includes(size)) return size;
  // Legacy px defaults map to nearest pt option
  if (size === "18px") return "14pt";
  if (size === "15px") return "11pt";
  if (size === "22px") return "16pt";
  if (size === "26px") return "20pt";
  return "12pt";
}