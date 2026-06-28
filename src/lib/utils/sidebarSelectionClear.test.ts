import { describe, expect, it, beforeEach } from "vitest";
import { sidebarSelection } from "$lib/stores/sidebarSelection.svelte";
import { clearSidebarSelectionOnOutsideClick } from "./sidebarSelectionClear";

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