import type { MindMapLink, MindMapNode } from "$lib/types";
import { nodeKey } from "$lib/utils/mindmapUtils";

export function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function hasLink(links: MindMapLink[], a: string, b: string): boolean {
  const k = linkKey(a, b);
  return links.some(
    (l) =>
      linkKey(
        nodeKey(l.from.section, l.from.id),
        nodeKey(l.to.section, l.to.id),
      ) === k,
  );
}

export function createLinksBetweenNodes(
  selectedKeys: string[],
  nodes: MindMapNode[],
  existingLinks: MindMapLink[],
): MindMapLink[] {
  if (selectedKeys.length < 2) return existingLinks;
  const newLinks: MindMapLink[] = [...existingLinks];
  for (let i = 0; i < selectedKeys.length; i++) {
    for (let j = i + 1; j < selectedKeys.length; j++) {
      if (hasLink(newLinks, selectedKeys[i], selectedKeys[j])) continue;
      const a = nodes.find((n) => n.key === selectedKeys[i]);
      const b = nodes.find((n) => n.key === selectedKeys[j]);
      if (!a || !b) continue;
      newLinks.push({
        id: crypto.randomUUID(),
        from: { id: a.id, section: a.section },
        to: { id: b.id, section: b.section },
      });
    }
  }
  return newLinks;
}

export function filterValidLinks(
  links: MindMapLink[],
  nodeKeys: Set<string>,
): MindMapLink[] {
  return links.filter((link) => {
    const fromKey = nodeKey(link.from.section, link.from.id);
    const toKey = nodeKey(link.to.section, link.to.id);
    return nodeKeys.has(fromKey) && nodeKeys.has(toKey);
  });
}