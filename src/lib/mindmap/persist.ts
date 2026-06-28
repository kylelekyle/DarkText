import * as api from "$lib/api";
import type { MindMapData, MindMapNode } from "$lib/types";

export function emptyMindMap(): MindMapData {
  return {
    version: 1,
    globalPinned: false,
    nodes: {},
    links: [],
    view: { panX: 0, panY: 0, zoom: 1 },
  };
}

export function mindMapSnapshot(
  base: MindMapData,
  nodes: MindMapNode[],
  globalPinned: boolean,
  panX: number,
  panY: number,
  zoom: number,
): MindMapData {
  const nodeRecord: MindMapData["nodes"] = {};
  for (const n of nodes) {
    nodeRecord[n.key] = { x: n.x, y: n.y, pinned: n.pinned };
  }
  return {
    ...base,
    globalPinned,
    nodes: nodeRecord,
    view: { panX, panY, zoom },
  };
}

export async function loadMindMapData(path: string): Promise<MindMapData> {
  return api.getMindMap(path);
}

export async function persistMindMapData(
  path: string,
  data: MindMapData,
): Promise<MindMapData> {
  return api.saveMindMap(path, data);
}