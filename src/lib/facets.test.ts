import { describe, it, expect } from "vitest";
import { needsEnrichment, applyFacets, type Facets } from "./facets";
import type { EnrichedItem } from "../types";

function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return { id: "brew:eza", name: "eza", source: "brew", source_detail: null, version: null,
    exec_path: null, homepage: null, raw_desc: null, installed_on_request: null, display_name: "eza",
    description: null, tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}
const NONE: Facets = { sources: [], tags: [], needsEnrichmentOnly: false, outdatedOnly: false };

describe("needsEnrichment", () => {
  it("true when no description and no tags", () => {
    expect(needsEnrichment(ei({ description: null, tags: [] }))).toBe(true);
  });
  it("false when it has a description or tags", () => {
    expect(needsEnrichment(ei({ description: "x" }))).toBe(false);
    expect(needsEnrichment(ei({ tags: ["cli"] }))).toBe(false);
  });
});

describe("applyFacets", () => {
  const items = [
    ei({ id: "brew:eza", source: "brew", tags: ["cli"], description: "ls" }),
    ei({ id: "go:gopls", source: "go", tags: [], description: null }),
    ei({ id: "cask:ghostty", source: "cask", tags: ["terminal"], description: "term" }),
  ];
  it("no facets returns all", () => {
    expect(applyFacets(items, NONE)).toHaveLength(3);
  });
  it("filters by source (any-of)", () => {
    expect(applyFacets(items, { ...NONE, sources: ["go", "cask"] }).map((i) => i.id).sort())
      .toEqual(["cask:ghostty", "go:gopls"]);
  });
  it("filters by tag (any-of)", () => {
    expect(applyFacets(items, { ...NONE, tags: ["cli"] }).map((i) => i.id)).toEqual(["brew:eza"]);
  });
  it("needs-enrichment only", () => {
    expect(applyFacets(items, { ...NONE, needsEnrichmentOnly: true }).map((i) => i.id)).toEqual(["go:gopls"]);
  });
  it("outdated only filters by the outdated id set", () => {
    const out = new Set(["cask:ghostty"]);
    expect(applyFacets(items, { ...NONE, outdatedOnly: true }, out).map((i) => i.id)).toEqual(["cask:ghostty"]);
  });
});
