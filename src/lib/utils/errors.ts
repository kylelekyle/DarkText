export function formatError(err: unknown): string {
  const raw = String(err);
  if (raw.includes("No Final chapters")) {
    return "No Final chapters to compile. Mark chapters as Final in the sidebar.";
  }
  if (raw.includes("library.json not found")) {
    return "This folder is not a valid Library. Choose a DarkText library folder.";
  }
  if (raw.includes("No chapters selected")) {
    return "Select at least one chapter to export.";
  }
  if (raw.includes("missing field `id`")) {
    return "Library data looks corrupted. A sidecar file may have been read as a chapter — try reopening after updating DarkText.";
  }
  const cleaned = raw.replace(/^Error:\s*/i, "").trim();
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}…` : cleaned;
}