import type { EnrichedItem } from "../types";

export interface Partitioned {
  favorites: EnrichedItem[];
  others: EnrichedItem[];
  hiddenCount: number;
}

/** Hidden items are excluded unless showHidden; favorites are pinned out of the rest. */
export function partitionItems(items: EnrichedItem[], showHidden: boolean): Partitioned {
  const favorites: EnrichedItem[] = [];
  const others: EnrichedItem[] = [];
  let hiddenCount = 0;
  for (const it of items) {
    if (it.hidden) {
      hiddenCount++;
      if (!showHidden) continue;
    }
    (it.favorite ? favorites : others).push(it);
  }
  return { favorites, others, hiddenCount };
}
