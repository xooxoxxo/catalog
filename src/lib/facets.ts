import type { EnrichedItem } from "../types";

export interface Facets {
  sources: string[];          // any-of; empty = no source filter
  tags: string[];             // any-of; empty = no tag filter
  needsEnrichmentOnly: boolean;
  outdatedOnly: boolean;       // NEW
}

/** An item that has neither a description nor any tags — a candidate for enrichment. */
export function needsEnrichment(item: EnrichedItem): boolean {
  return !item.description && item.tags.length === 0;
}

export function applyFacets(items: EnrichedItem[], f: Facets, outdatedIds?: Set<string>): EnrichedItem[] {
  return items.filter((it) => {
    if (f.sources.length && !f.sources.includes(it.source)) return false;
    if (f.tags.length && !f.tags.some((t) => it.tags.includes(t))) return false;
    if (f.needsEnrichmentOnly && !needsEnrichment(it)) return false;
    if (f.outdatedOnly && !(outdatedIds?.has(it.id))) return false;   // NEW
    return true;
  });
}
