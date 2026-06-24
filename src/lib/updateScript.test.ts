import { describe, it, expect } from "vitest";
import { buildUpdateScript } from "./updateScript";
import type { EnrichedItem } from "../types";

function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return {
    id: "brew:eza",
    name: "eza",
    source: "brew",
    source_detail: null,
    version: null,
    exec_path: null,
    homepage: null,
    raw_desc: null,
    installed_on_request: null,
    display_name: "eza",
    description: null,
    tags: [],
    favorite: false,
    hidden: false,
    notes: "",
    llm_confirmed: false,
    has_enrichment: false,
    ...o,
  };
}

describe("buildUpdateScript", () => {
  it("empty list → empty string", () => expect(buildUpdateScript([])).toBe(""));

  it("batches per manager", () => {
    const s = buildUpdateScript([
      ei({ id: "brew:eza", source: "brew", name: "eza" }),
      ei({ id: "brew:rg", source: "brew", name: "rg" }),
      ei({ id: "cask:ghostty", source: "cask", name: "Ghostty" }),
      ei({ id: "npm:typescript", source: "npm", name: "typescript" }),
      ei({ id: "mas:497799835", source: "mas", name: "Xcode" }),
    ]);
    expect(s).toBe(
      "brew upgrade eza rg\n" +
        "brew upgrade --cask ghostty\n" +
        "npm install -g typescript@latest\n" +
        "mas upgrade 497799835"
    );
  });

  it("skips sources with no items + ignores non-upgradable", () => {
    expect(buildUpdateScript([ei({ id: "go:gopls", source: "go" })])).toBe("");
  });
});
