import type { EnrichedItem, Enrichment } from "../types";

export interface EnrichDraft { alias: string; description: string; tags: string; notes: string; }

export function draftFromItem(it: EnrichedItem): EnrichDraft {
  return {
    alias: it.display_name === it.name ? "" : it.display_name,
    description: it.description ?? "",
    tags: it.tags.join(", "),
    notes: it.notes,
  };
}

function normTags(s: string): string {
  return s.split(",").map((t) => t.trim()).filter(Boolean).join(",");
}

export function isDirty(d: EnrichDraft, it: EnrichedItem): boolean {
  const o = draftFromItem(it);
  return d.alias.trim() !== o.alias.trim()
    || d.description.trim() !== o.description.trim()
    || normTags(d.tags) !== normTags(o.tags)
    || d.notes.trim() !== o.notes.trim();
}

/** Full Enrichment from the text draft + the item's current favorite/hidden/llm_confirmed. */
export function toEnrichment(d: EnrichDraft, it: EnrichedItem): Enrichment {
  return {
    alias: d.alias.trim(),
    description: d.description.trim(),
    tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
    favorite: it.favorite,
    hidden: it.hidden,
    notes: d.notes.trim(),
    llm_confirmed: it.llm_confirmed,
  };
}
