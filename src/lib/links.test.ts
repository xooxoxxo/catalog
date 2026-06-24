import { describe, it, expect } from "vitest";
import { itemLinks } from "./links";
import type { EnrichedItem } from "../types";

function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return { id: "brew:eza", name: "eza", source: "brew", source_detail: null, version: null,
    exec_path: null, homepage: null, raw_desc: null, installed_on_request: null, display_name: "eza",
    description: null, tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}

describe("itemLinks", () => {
  it("includes homepage when present", () => {
    const ls = itemLinks(ei({ homepage: "https://eza.rocks" }));
    expect(ls.some((l) => l.label === "Homepage" && l.url === "https://eza.rocks")).toBe(true);
  });
  it("builds the Homebrew formula page from the id token", () => {
    const ls = itemLinks(ei({ id: "brew:eza", source: "brew", name: "eza" }));
    expect(ls.some((l) => l.url === "https://formulae.brew.sh/formula/eza")).toBe(true);
  });
  it("builds the Homebrew cask page from the cask token (not display name)", () => {
    const ls = itemLinks(ei({ id: "cask:ghostty", source: "cask", name: "Ghostty" }));
    expect(ls.some((l) => l.url === "https://formulae.brew.sh/cask/ghostty")).toBe(true);
  });
  it("always offers context7 docs", () => {
    const ls = itemLinks(ei({}));
    expect(ls.some((l) => l.label === "context7 docs")).toBe(true);
  });
  it("only surfaces Homepage / Homebrew / context7 (no search/source noise)", () => {
    const labels = itemLinks(ei({ homepage: "https://eza.rocks" })).map((l) => l.label);
    expect(labels).toEqual(["Homepage", "Homebrew formula", "context7 docs"]);
  });
});
