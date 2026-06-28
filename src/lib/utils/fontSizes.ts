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