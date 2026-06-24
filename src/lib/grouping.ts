import type { EnrichedItem } from "../types";

export type GroupBy = "none" | "source" | "tag";

export type ListRow =
  | { type: "header"; key: string; label: string; count: number; collapsed: boolean }
  // `group` is the owning tag when grouping by tag, so the row can suppress
  // that one redundant tag (it's already the group header).
  | { type: "item"; key: string; item: EnrichedItem; group?: string };

/** Flatten items into a header+item row list for the virtualizer.
 *  - "none": just item rows (no headers).
 *  - "source": grouped by item.source, alphabetical.
 *  - "tag": grouped by each tag (an item with N tags appears in N groups); untagged
 *    items fall into an "untagged" group sorted last.
 *  Collapsed group keys keep their header but omit their items. */
export function groupRows(items: EnrichedItem[], by: GroupBy, collapsed: Set<string>): ListRow[] {
  if (by === "none") return items.map((item) => ({ type: "item", key: item.id, item }));

  const groups = new Map<string, EnrichedItem[]>();
  const add = (k: string, it: EnrichedItem) => {
    const a = groups.get(k);
    if (a) a.push(it);
    else groups.set(k, [it]);
  };
  for (const it of items) {
    if (by === "source") add(it.source, it);
    else if (it.tags.length === 0) add("untagged", it);
    else for (const t of it.tags) add(t, it);
  }

  const keys = [...groups.keys()].sort((a, b) =>
    a === "untagged" ? 1 : b === "untagged" ? -1 : a.localeCompare(b),
  );

  const rows: ListRow[] = [];
  for (const k of keys) {
    const groupItems = groups.get(k)!;
    const isCollapsed = collapsed.has(k);
    rows.push({ type: "header", key: k, label: k, count: groupItems.length, collapsed: isCollapsed });
    // key is group-scoped so a multi-tag item under several groups stays unique
    if (!isCollapsed) for (const item of groupItems) rows.push({ type: "item", key: `${k}:${item.id}`, item, group: by === "tag" ? k : undefined });
  }
  return rows;
}
