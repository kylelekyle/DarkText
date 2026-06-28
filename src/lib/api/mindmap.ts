import { invoke } from "@tauri-apps/api/core";
import type { MindMapData } from "$lib/types";

export async function getMindMap(libraryPath: string): Promise<MindMapData> {
  return invoke("get_mindmap", { libraryPath });
}

export async function saveMindMap(
  libraryPath: string,
  data: MindMapData,
): Promise<MindMapData> {
  return invoke("save_mindmap", { libraryPath, data });
}