import { describe, expect, it } from "vitest";
import { ALPHA_MIN, Simulation } from "./simulation";
import { missingCliqueLinks, missingStarLinks, pairKey } from "./linkOps";
import { DEFAULT_PARAMS, nodeRadius, seedPosition, type GraphNode } from "./types";

function node(id: string, x: number, y: number, pinned = false): GraphNode {
  return {
    id,
    label: id,
    section: "chapters",
    x,
    y,
    vx: 0,
    vy: 0,
    fx: pinned ? x : null,
    fy: pinned ? y : null,
    pinned,
    degree: 0,
    r: nodeRadius(0),
    pulseAt: 0,
    popAt: 0,
  };
}

function sim(nodes: GraphNode[], links: Array<[GraphNode, GraphNode]> = []) {
  const s = new Simulation({ ...DEFAULT_PARAMS, center: 0 });
  s.nodes = nodes;
  s.links = links.map(([source, target], i) => ({
    id: String(i),
    source,
    target,
    bornAt: 0,
  }));
  s.reheat();
  return s;
}

describe("Simulation", () => {
  it("repulsion pushes free nodes apart", () => {
    const a = node("a", 0, 0);
    const b = node("b", 30, 0);
    const s = sim([a, b]);
    for (let i = 0; i < 30; i++) s.tick();
    expect(b.x - a.x).toBeGreaterThan(30);
  });

  it("springs pull linked nodes toward the resting length", () => {
    const a = node("a", 0, 0);
    const b = node("b", 500, 0);
    const s = sim([a, b], [[a, b]]);
    const before = b.x - a.x;
    for (let i = 0; i < 120; i++) {
      s.reheat(0.5);
      s.tick();
    }
    const after = Math.hypot(b.x - a.x, b.y - a.y);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(DEFAULT_PARAMS.linkDistance * 0.4);
  });

  it("pinned nodes never move but still repel neighbours", () => {
    const anchor = node("anchor", 0, 0, true);
    const free = node("free", 20, 0);
    const s = sim([anchor, free]);
    for (let i = 0; i < 30; i++) s.tick();
    expect(anchor.x).toBe(0);
    expect(anchor.y).toBe(0);
    expect(free.x).toBeGreaterThan(20);
  });

  it("cools down and sleeps at low alpha", () => {
    const s = sim([node("a", 0, 0), node("b", 100, 0)]);
    let ticks = 0;
    while (s.tick()) ticks++;
    expect(ticks).toBeGreaterThan(10);
    expect(s.alpha).toBeLessThanOrEqual(ALPHA_MIN);
    expect(s.tick()).toBe(false);
  });

  it("collision separates overlapping free nodes", () => {
    const a = node("a", 0, 0);
    const b = node("b", 1, 0);
    const s = sim([a, b]);
    for (let i = 0; i < 40; i++) s.tick();
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    expect(d).toBeGreaterThanOrEqual(a.r + b.r);
  });
});

describe("linkOps", () => {
  it("clique produces every missing pair exactly once", () => {
    const existing = new Set([pairKey("a", "b")]);
    const pairs = missingCliqueLinks(["a", "b", "c"], existing);
    expect(pairs).toEqual([
      ["a", "c"],
      ["b", "c"],
    ]);
  });

  it("star links everything to the hub, skipping existing and self", () => {
    const existing = new Set([pairKey("hub", "b")]);
    const pairs = missingStarLinks("hub", ["a", "b", "hub"], existing);
    expect(pairs).toEqual([["hub", "a"]]);
  });
});

describe("seedPosition", () => {
  it("is deterministic and spreads points out", () => {
    const a = seedPosition(0);
    const b = seedPosition(1);
    expect(seedPosition(0)).toEqual(a);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(10);
  });
});
