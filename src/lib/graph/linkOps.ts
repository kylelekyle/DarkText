/** Pure helpers for link creation (pairwise, clique, star). Undirected. */

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Node-id pairs needed to make `ids` a complete subgraph (clique). */
export function missingCliqueLinks(
  ids: string[],
  existing: Set<string>,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (ids[i] === ids[j]) continue;
      if (!existing.has(pairKey(ids[i], ids[j]))) {
        out.push([ids[i], ids[j]]);
        existing.add(pairKey(ids[i], ids[j]));
      }
    }
  }
  return out;
}

/** Node-id pairs needed to link every id to `hub` (star pattern). */
export function missingStarLinks(
  hub: string,
  ids: string[],
  existing: Set<string>,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const id of ids) {
    if (id === hub) continue;
    if (!existing.has(pairKey(hub, id))) {
      out.push([hub, id]);
      existing.add(pairKey(hub, id));
    }
  }
  return out;
}
