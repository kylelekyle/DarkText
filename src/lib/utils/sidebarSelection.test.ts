import { describe, expect, it, beforeEach } from "vitest";
import { SidebarSelectionStore } from "$lib/stores/sidebarSelection.svelte";
import { sidebarSelection } from "$lib/stores/sidebarSelection.svelte";
import {
  clearSidebarSelectionOnOutsideClick,
  handleSidebarChapterClick,
} from "./sidebarSelection";

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

describe("clearSidebarSelectionOnOutsideClick", () => {
  beforeEach(() => {
    sidebarSelection.clear();
  });

  it("clears when clicking outside sidebar rows", () => {
    sidebarSelection.selectSingle("a");
    clearSidebarSelectionOnOutsideClick(new MouseEvent("click"));
    expect(sidebarSelection.hasSelection).toBe(false);
  });

  it("keeps selection when click target is a sidebar row", () => {
    sidebarSelection.selectSingle("a");
    const row = document.createElement("li");
    row.className = "list-item";
    const list = document.createElement("ul");
    list.className = "item-list";
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    list.appendChild(row);
    sidebar.appendChild(list);
    document.body.appendChild(sidebar);

    clearSidebarSelectionOnOutsideClick({ target: row } as unknown as MouseEvent);
    expect(sidebarSelection.hasSelection).toBe(true);

    document.body.removeChild(sidebar);
  });
});