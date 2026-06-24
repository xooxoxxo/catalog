import type { EnrichedItem } from "../types";

export interface Partitioned {
  favorites: EnrichedItem[];
  others: EnrichedItem[];
  hiddenCount: number;
}

/** Hidden items are excluded unless showHidden; favorites are pinned out of the rest. */
export function partitionItems(items: EnrichedItem[], showHidden: boolean): Partitioned {
  const hiddenCount = items.filter((i) => i.hidden).length;
  const visible = showHidden ? items : items.filter((i) => !i.hidden);
  return {
    favorites: visible.filter((i) => i.favorite),
    others: visible.filter((i) => !i.favorite),
    hiddenCount,
  };
}
