import type { EnrichedItem } from "../types";

export interface TagOption {
  tag: string;
  count: number;
}

/** Pure: distinct tags across items with counts; sorted by count desc, then tag asc. */
export function tagFacetOptions(items: EnrichedItem[]): TagOption[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    for (const t of it.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
