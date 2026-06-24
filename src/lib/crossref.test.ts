import { describe, it, expect } from "vitest";
import { isInstalled } from "./crossref";
import type { EnrichedItem, Repo } from "../types";

const repo = (o: string, n: string): Repo => ({ full_name: `${o}/${n}`, name: n, owner: o, description: null, language: null, stars: 0, html_url: `https://github.com/${o}/${n}` });
function item(o: Partial<EnrichedItem>): EnrichedItem {
  return { id: "brew:x", name: "x", source: "brew", source_detail: null, version: null, exec_path: null,
    homepage: null, raw_desc: null, installed_on_request: null, display_name: "x", description: null,
    tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}

describe("isInstalled", () => {
  it("matches by homepage github url", () => {
    expect(isInstalled(repo("BurntSushi", "ripgrep"), [item({ name: "ripgrep", homepage: "https://github.com/BurntSushi/ripgrep" })])).toBe(true);
  });
  it("matches by name fallback", () => {
    expect(isInstalled(repo("BurntSushi", "ripgrep"), [item({ name: "ripgrep", homepage: "https://eza.rocks" })])).toBe(true);
  });
  it("is case-insensitive on the url", () => {
    expect(isInstalled(repo("Owner", "Tool"), [item({ name: "z", homepage: "https://GitHub.com/Owner/Tool/" })])).toBe(true);
  });
  it("no match", () => {
    expect(isInstalled(repo("a", "b"), [item({ name: "c", homepage: "https://x.y" })])).toBe(false);
  });
});
