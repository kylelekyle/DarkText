import { describe, expect, it, afterEach } from "vitest";
import { portal } from "./portal";

describe("portal", () => {
  const nodes: HTMLElement[] = [];

  afterEach(() => {
    for (const node of nodes) node.remove();
    nodes.length = 0;
  });

  it("moves the node to document.body", () => {
    const node = document.createElement("aside");
    node.className = "review-slot";
    nodes.push(node);
    portal(node);
    expect(node.parentElement).toBe(document.body);
  });

  it("removes the node on destroy", () => {
    const node = document.createElement("aside");
    nodes.push(node);
    const handle = portal(node);
    handle.destroy();
    expect(node.parentElement).toBeNull();
  });
});