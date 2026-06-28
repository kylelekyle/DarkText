/**
 * Vitest / non-Tauri fallback only. Production export uses Rust `strip_review_marks_html`.
 * Keep fixtures aligned with `compile.rs` tests.
 */
const REVIEW_MARK_CLASSES = ["dt-comment", "dt-insertion", "dt-deletion"] as const;

function stripSpanWithClass(html: string, className: string): string {
  let out = html;
  const needle = `class="${className}"`;
  for (;;) {
    const classIdx = out.indexOf(needle);
    if (classIdx < 0) break;
    const spanStart = out.lastIndexOf("<span", classIdx);
    if (spanStart < 0) break;
    const gtRel = out.indexOf(">", spanStart);
    if (gtRel < 0) break;
    const contentStart = gtRel + 1;
    const closeRel = out.indexOf("</span>", contentStart);
    if (closeRel < 0) break;
    const inner = out.slice(contentStart, closeRel);
    out = out.slice(0, spanStart) + inner + out.slice(closeRel + 7);
  }
  return out;
}

/** Remove review mark spans while preserving inner text (mirrors Rust compile::strip_review_marks). */
export function stripReviewMarks(html: string): string {
  let result = html;
  for (const marker of REVIEW_MARK_CLASSES) {
    result = stripSpanWithClass(result, marker);
  }
  return result;
}
