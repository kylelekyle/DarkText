import type { Editor } from "@tiptap/core";
import { fontSizePtCss, resolveFontSize } from "$lib/utils/typography";

/** Point size at the cursor, from inline marks or stored typing marks. */
export function fontSizeMarkAtEditor(ed: Editor): string | null {
  const attr = ed.getAttributes("textStyle")?.fontSize;
  if (typeof attr === "string" && attr.trim()) return resolveFontSize(attr);

  const stored = ed.state.storedMarks ?? ed.state.selection.$from.marks();
  const textStyle = stored.find((m) => m.type.name === "textStyle");
  const storedSize = textStyle?.attrs?.fontSize;
  if (typeof storedSize === "string" && storedSize.trim()) return resolveFontSize(storedSize);

  return null;
}

export function stickyFontSizeIsActive(ed: Editor, typingFontSize: string): boolean {
  const stored = ed.state.storedMarks;
  if (!stored?.length) return false;
  const textStyle = stored.find((m) => m.type.name === "textStyle");
  return resolveFontSize(textStyle?.attrs?.fontSize ?? "") === typingFontSize;
}

/** Keep the chosen size on stored marks for new typing (mirrors sticky font family). */
export function applyStickyFontSize(ed: Editor, typingFontSize: string): void {
  if (!ed.state.selection.empty || stickyFontSizeIsActive(ed, typingFontSize)) return;
  ed.commands.setFontSize(fontSizePtCss(typingFontSize));
}