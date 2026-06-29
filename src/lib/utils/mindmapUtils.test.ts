import { describe, expect, it } from "vitest";
import { mindmapLibraryFingerprint } from "./mindmapUtils";
import type { ChapterMeta } from "$lib/types";

const ch = (id: string, title: string, order: number, status: ChapterMeta["status"]): ChapterMeta => ({
  id,
  title,
  order,
  status,
  updatedAt: "2026-01-01",
});

describe("mindmapLibraryFingerprint", () => {
  it("changes when title changes", () => {
    const a = mindmapLibraryFingerprint([ch("1", "Alpha", 0, "draft")], [], []);
    const b = mindmapLibraryFingerprint([ch("1", "Beta", 0, "draft")], [], []);
    expect(a).not.toBe(b);
  });

  it("is stable for identical inputs", () => {
    const chapters = [ch("1", "Alpha", 0, "draft")];
    const research = [ch("2", "Note", 0, "draft")];
    const fp = mindmapLibraryFingerprint(chapters, research, []);
    expect(mindmapLibraryFingerprint(chapters, research, [])).toBe(fp);
  });

  it("includes all three sections", () => {
    const fp = mindmapLibraryFingerprint(
      [ch("c", "Ch", 0, "draft")],
      [ch("r", "Res", 0, "final")],
      [ch("x", "Char", 0, "needs-refine")],
    );
    expect(fp).toContain("c:c:");
    expect(fp).toContain("r:r:");
    expect(fp).toContain("x:x:");
  });
});