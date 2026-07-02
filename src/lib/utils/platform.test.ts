import { afterEach, describe, expect, it, vi } from "vitest";
import { portal, suppressNativeContextMenu } from "./platform";

describe("portal", () => {
  const nodes: HTMLElement[] = [];

  afterEach(() => {
    for (const node of nodes) node.remove();
    nodes.length = 0;
  });

  it("moves the node to document.body by default", () => {
    const node = document.createElement("aside");
    node.className = "review-slot";
    nodes.push(node);
    portal(node);
    expect(node.parentElement).toBe(document.body);
  });

  it("moves the node to a selector target", () => {
    const host = document.createElement("div");
    host.id = "portal-host";
    document.body.appendChild(host);
    nodes.push(host);
    const node = document.createElement("aside");
    nodes.push(node);
    portal(node, "#portal-host");
    expect(node.parentElement).toBe(host);
  });

  it("removes the node on destroy", () => {
    const node = document.createElement("aside");
    nodes.push(node);
    const handle = portal(node);
    handle.destroy();
    expect(node.parentElement).toBeNull();
  });
});

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