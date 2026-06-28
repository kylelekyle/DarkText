import { describe, expect, it } from "vitest";
import { SidebarSelectionStore } from "$lib/stores/sidebarSelection.svelte";
import { handleSidebarChapterClick } from "./sidebarSelectionClick";

describe("handleSidebarChapterClick", () => {
  const items = [
    { id: "a", title: "A", status: "draft" as const, order: 0, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "b", title: "B", status: "draft" as const, order: 1, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "c", title: "C", status: "draft" as const, order: 2, updatedAt: "2026-01-01T00:00:00Z" },
  ];

  it("plain click opens without keeping a selection highlight", () => {
    const selection = new SidebarSelectionStore();
    selection.selectSingle("a");
    const result = handleSidebarChapterClick(
      new MouseEvent("click"),
      "b",
      items,
      selection,
    );
    expect(result).toEqual({ open: true, chapterId: "b" });
    expect(selection.count).toBe(0);
    expect(selection.anchorId).toBe("b");
  });

  it("ctrl click toggles without opening", () => {
    const selection = new SidebarSelectionStore();
    selection.selectSingle("a");
    const result = handleSidebarChapterClick(
      new MouseEvent("click", { ctrlKey: true }),
      "c",
      items,
      selection,
    );
    expect(result.open).toBe(false);
    expect(selection.isSelected("a")).toBe(true);
    expect(selection.isSelected("c")).toBe(true);
  });

  it("shift click selects a range", () => {
    const selection = new SidebarSelectionStore();
    selection.selectSingle("a");
    const result = handleSidebarChapterClick(
      new MouseEvent("click", { shiftKey: true }),
      "c",
      items,
      selection,
    );
    expect(result.open).toBe(false);
    expect([...selection.selectedIds]).toEqual(["a", "b", "c"]);
  });
});