import { describe, it, expect } from "vitest";
import { filterItems } from "./filter";
import type { EnrichedItem } from "../types";

function ei(id: string, o: Partial<EnrichedItem> = {}): EnrichedItem {
  return { id, name: id, source: "brew", source_detail: null, version: null, exec_path: null,
    homepage: null, raw_desc: null, installed_on_request: null, display_name: id, description: null,
    tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}

const items: EnrichedItem[] = [
  ei("brew:eza", { display_name: "eza", description: "modern ls replacement" }),
  ei("brew:ripgrep", { display_name: "ripgrep", description: "fast grep" }),
];

describe("filterItems", () => {
  it("returns all items for empty query", () => {
    expect(filterItems(items, "")).toHaveLength(2);
  });
  it("matches on display_name", () => {
    expect(filterItems(items, "eza").map((i) => i.id)).toEqual(["brew:eza"]);
  });
  it("matches on description text", () => {
    expect(filterItems(items, "fast").map((i) => i.id)).toEqual(["brew:ripgrep"]);
  });
});
