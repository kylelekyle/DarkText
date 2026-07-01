import * as api from "$lib/api";
import type { MindMapData } from "$lib/types";

/** v1 card dimensions — kept only for the v1→v2 coordinate migration. */
const LEGACY_CARD_W = 128;
const LEGACY_CARD_H = 72;

/**
 * v2 switched node coordinates from card-top-left to center for graph physics.
 * v3 made pins explicit anchors only — drags no longer auto-pin, and legacy
 * auto-pins are cleared so the simulation actually runs.
 */
export const MINDMAP_VERSION = 3;

export function emptyMindMap(): MindMapData {
  return {
    version: MINDMAP_VERSION,
    globalPinned: false,
    nodes: {},
    links: [],
    view: { panX: 0, panY: 0, zoom: 1 },
  };
}

/**
 * Bring a loaded map up to the current version. v1 stored node coordinates as
 * the top-left of a 128x72 card; v2+ stores centers, so shift each node by
 * half a legacy card. v3 clears pins, which older versions set on every drag.
 * Idempotent — current-version maps pass through untouched.
 */
export function migrateMindMapData(data: MindMapData): MindMapData {
  const version = data.version ?? 1;
  if (version >= MINDMAP_VERSION) return data;
  const nodes: MindMapData["nodes"] = {};
  for (const [key, pos] of Object.entries(data.nodes)) {
    nodes[key] = {
      x: version < 2 ? pos.x + LEGACY_CARD_W / 2 : pos.x,
      y: version < 2 ? pos.y + LEGACY_CARD_H / 2 : pos.y,
      pinned: false,
    };
  }
  return { ...data, version: MINDMAP_VERSION, nodes };
}

export async function loadMindMapData(path: string): Promise<MindMapData> {
  return migrateMindMapData(await api.getMindMap(path));
}

export async function persistMindMapData(
  path: string,
  data: MindMapData,
): Promise<MindMapData> {
  return api.saveMindMap(path, data);
}