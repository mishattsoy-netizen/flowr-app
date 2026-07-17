/** True if (a,b) is the same undirected pair as (from,to). */
export function isSameNodePair(
  a: string,
  b: string,
  from: string,
  to: string,
): boolean {
  return (a === from && b === to) || (a === to && b === from);
}

/** True if any edge already links the two nodes (either direction). */
export function hasEdgeBetween(
  edges: { from_node: string; to_node: string }[],
  from: string,
  to: string,
): boolean {
  return edges.some(e => isSameNodePair(e.from_node, e.to_node, from, to));
}

/** Stable undirected pair key so A–B and B–A group together. */
export function undirectedPairKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

/**
 * Among active edges, keep one per undirected node pair (oldest by
 * created_at, then id). Returns keepers and ids of extras to soft-delete.
 */
export function partitionDuplicateEdges<
  T extends { id: string; from_node: string; to_node: string; created_at?: string },
>(edges: T[]): { keep: T[]; removeIds: string[] } {
  const groups = new Map<string, T[]>();
  for (const e of edges) {
    const key = undirectedPairKey(e.from_node, e.to_node);
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  const keep: T[] = [];
  const removeIds: string[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      keep.push(group[0]);
      continue;
    }
    group.sort((a, b) => {
      const ta = a.created_at ?? '';
      const tb = b.created_at ?? '';
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    keep.push(group[0]);
    for (let i = 1; i < group.length; i++) removeIds.push(group[i].id);
  }
  return { keep, removeIds };
}
