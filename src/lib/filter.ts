import Fuse from "fuse.js";
import type { EnrichedItem } from "../types";

export function filterItems(items: EnrichedItem[], query: string): EnrichedItem[] {
  const q = query.trim();
  if (!q) return items;
  const fuse = new Fuse(items, {
    keys: ["display_name", "name", "description", "tags", "source"],
    threshold: 0.3,
    ignoreLocation: true,
  });
  return fuse.search(q).map((r) => r.item);
}
