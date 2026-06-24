import { describe, it, expect } from "vitest";
import { draftFromItem, isDirty, toEnrichment } from "./draft";
import type { EnrichedItem } from "../types";

function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return { id: "brew:eza", name: "eza", source: "brew", source_detail: null, version: null,
    exec_path: null, homepage: null, raw_desc: null, installed_on_request: null, display_name: "eza",
    description: null, tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}

describe("draftFromItem", () => {
  it("alias blank when display_name equals name", () => {
    expect(draftFromItem(ei({})).alias).toBe("");
  });
  it("alias set when display_name differs", () => {
    expect(draftFromItem(ei({ display_name: "eza (ls)" })).alias).toBe("eza (ls)");
  });
  it("tags joined; description/notes carried", () => {
    const d = draftFromItem(ei({ tags: ["cli", "ls"], description: "modern ls", notes: "n" }));
    expect(d.tags).toBe("cli, ls");
    expect(d.description).toBe("modern ls");
    expect(d.notes).toBe("n");
  });
});

describe("isDirty", () => {
  const item = ei({ display_name: "eza", description: "d", tags: ["cli"], notes: "n" });
  it("false when draft matches", () => {
    expect(isDirty(draftFromItem(item), item)).toBe(false);
  });
  it("true when a field changed", () => {
    expect(isDirty({ ...draftFromItem(item), description: "new" }, item)).toBe(true);
  });
  it("ignores tag whitespace/order-as-typed differences", () => {
    expect(isDirty({ ...draftFromItem(item), tags: " cli " }, item)).toBe(false);
  });
});

describe("toEnrichment", () => {
  it("parses tags + preserves favorite/hidden/llm_confirmed from item", () => {
    const item = ei({ favorite: true, hidden: true, llm_confirmed: true });
    const e = toEnrichment({ alias: "A", description: "D", tags: "x, y", notes: "N" }, item);
    expect(e).toEqual({ alias: "A", description: "D", tags: ["x", "y"], favorite: true, hidden: true, notes: "N", llm_confirmed: true });
  });
});
