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