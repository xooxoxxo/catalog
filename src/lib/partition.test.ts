import { describe, it, expect } from "vitest";
import { partitionItems } from "./partition";
import type { EnrichedItem } from "../types";

function ei(id: string, o: Partial<EnrichedItem> = {}): EnrichedItem {
  return { id, name: id, source: "brew", source_detail: null, version: null, exec_path: null,
    homepage: null, raw_desc: null, installed_on_request: null, display_name: id, description: null,
    tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}

describe("partitionItems", () => {
  it("hides hidden items by default and counts them", () => {
    const r = partitionItems([ei("a"), ei("b", { hidden: true })], false);
    expect(r.others.map((i) => i.id)).toEqual(["a"]);
    expect(r.favorites).toEqual([]);
    expect(r.hiddenCount).toBe(1);
  });
  it("includes hidden when showHidden=true", () => {
    const r = partitionItems([ei("a"), ei("b", { hidden: true })], true);
    expect(r.others.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });
  it("splits favorites from others (favorites never hidden-counted)", () => {
    const r = partitionItems([ei("a", { favorite: true }), ei("b")], false);
    expect(r.favorites.map((i) => i.id)).toEqual(["a"]);
    expect(r.others.map((i) => i.id)).toEqual(["b"]);
  });
});
