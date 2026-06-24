import { describe, it, expect } from "vitest";
import { tagFacetOptions } from "./tagFacets";
import type { EnrichedItem } from "../types";

function ei(tags: string[]): EnrichedItem {
  return {
    id: "x",
    name: "x",
    source: "brew",
    source_detail: null,
    version: null,
    exec_path: null,
    homepage: null,
    raw_desc: null,
    installed_on_request: null,
    display_name: "x",
    description: null,
    tags,
    favorite: false,
    hidden: false,
    notes: "",
    llm_confirmed: false,
    has_enrichment: false,
  };
}

describe("tagFacetOptions", () => {
  it("counts tags + sorts by count desc then name", () => {
    const opts = tagFacetOptions([
      ei(["cli", "dev"]),
      ei(["cli"]),
      ei(["media", "cli"]),
      ei([]),
    ]);
    expect(opts).toEqual([
      { tag: "cli", count: 3 },
      { tag: "dev", count: 1 },
      { tag: "media", count: 1 },
    ]);
  });
  it("empty when no tags", () =>
    expect(tagFacetOptions([ei([])])).toEqual([]));
});
