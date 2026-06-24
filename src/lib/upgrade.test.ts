import { describe, it, expect } from "vitest";
import { upgradeCommand } from "./upgrade";
import type { EnrichedItem } from "../types";
function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return { id: "brew:eza", name: "eza", source: "brew", source_detail: null, version: null, exec_path: null,
    homepage: null, raw_desc: null, installed_on_request: null, display_name: "eza", description: null,
    tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}
describe("upgradeCommand", () => {
  it("brew", () => expect(upgradeCommand(ei({ id: "brew:eza", source: "brew" }))).toBe("brew upgrade eza"));
  it("cask uses token", () => expect(upgradeCommand(ei({ id: "cask:ghostty", source: "cask", name: "Ghostty" }))).toBe("brew upgrade --cask ghostty"));
  it("npm", () => expect(upgradeCommand(ei({ id: "npm:typescript", source: "npm", name: "typescript" }))).toBe("npm install -g typescript@latest"));
  it("mas uses id", () => expect(upgradeCommand(ei({ id: "mas:497799835", source: "mas" }))).toBe("mas upgrade 497799835"));
  it("null otherwise", () => { expect(upgradeCommand(ei({ id: "go:gopls", source: "go" }))).toBeNull(); });
});
