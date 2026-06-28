import { describe, expect, it, vi } from "vitest";
import { suppressNativeContextMenu } from "./suppressNativeContextMenu";

describe("suppressNativeContextMenu", () => {
  it("prevents default on generic elements", () => {
    const div = document.createElement("div");
    const event = new MouseEvent("contextmenu", { bubbles: true });
    Object.defineProperty(event, "target", { value: div });
    const prevent = vi.spyOn(event, "preventDefault");

    suppressNativeContextMenu(event);

    expect(prevent).toHaveBeenCalled();
  });

  it("allows native menu on text inputs", () => {
    const input = document.createElement("input");
    const event = new MouseEvent("contextmenu", { bubbles: true });
    Object.defineProperty(event, "target", { value: input });
    const prevent = vi.spyOn(event, "preventDefault");

    suppressNativeContextMenu(event);

    expect(prevent).not.toHaveBeenCalled();
  });

  it("allows native menu on textareas", () => {
    const textarea = document.createElement("textarea");
    const event = new MouseEvent("contextmenu", { bubbles: true });
    Object.defineProperty(event, "target", { value: textarea });
    const prevent = vi.spyOn(event, "preventDefault");

    suppressNativeContextMenu(event);

    expect(prevent).not.toHaveBeenCalled();
  });
});