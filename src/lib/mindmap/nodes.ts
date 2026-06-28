import type {
  ChapterMeta,
  ChapterSection,
  MindMapData,
  MindMapLink,
  MindMapNode,
} from "$lib/types";
import { defaultNodePosition, nodeKey } from "$lib/utils/mindmapLayout";
import { filterValidLinks } from "./links";

export type BuildMindMapNodesInput = {
  chapters: ChapterMeta[];
  research: ChapterMeta[];
  characters: ChapterMeta[];
  savedNodes: MindMapData["nodes"];
  existingNodes: MindMapNode[];
  links: MindMapLink[];
};

export type BuildMindMapNodesResult = {
  nodes: MindMapNode[];
  links: MindMapLink[];
};

export function buildMindMapNodes(input: BuildMindMapNodesInput): BuildMindMapNodesResult {
  const { chapters, research, characters, savedNodes, existingNodes, links } = input;
  const live = new Map(existingNodes.map((n) => [n.key, { x: n.x, y: n.y }]));
  const list: MindMapNode[] = [];

  const pushNode = (
    ch: ChapterMeta,
    section: ChapterSection,
    index: number,
    sectionTag: ChapterSection,
  ) => {
    const key = nodeKey(section, ch.id);
    const saved = savedNodes[key];
    const prev = existingNodes.find((n) => n.key === key);
    const livePos = live.get(key);
    const pos = livePos
      ? livePos
      : saved
        ? { x: saved.x, y: saved.y }
        : defaultNodePosition(
            index,
            sectionTag,
            chapters.length,
            research.length,
            characters.length,
          );
    list.push({
      key,
      id: ch.id,
      section,
      title: ch.title,
      status: ch.status,
      x: pos.x,
      y: pos.y,
      pinned: prev?.pinned ?? saved?.pinned ?? false,
    });
  };

  chapters.forEach((ch, i) => pushNode(ch, "chapters", i, "chapters"));
  research.forEach((ch, i) => pushNode(ch, "research", i, "research"));
  characters.forEach((ch, i) => pushNode(ch, "characters", i, "characters"));

  const nodeKeys = new Set(list.map((n) => n.key));
  const filteredLinks = filterValidLinks(links, nodeKeys);

  return { nodes: list, links: filteredLinks };
}

export function liveNodePositions(nodes: MindMapNode[]): Map<string, { x: number; y: number }> {
  return new Map(nodes.map((n) => [n.key, { x: n.x, y: n.y }]));
}