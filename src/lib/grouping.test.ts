import { describe, it, expect } from "vitest";
import { groupRows } from "./grouping";
import type { EnrichedItem } from "../types";

function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return {
    id: "x", name: "x", source: "brew", source_detail: null, version: null, exec_path: null,
    homepage: null, raw_desc: null, installed_on_request: null, display_name: "x",
    description: null, tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false,
    has_enrichment: false, ...o,
  };
}

const ITEMS: EnrichedItem[] = [
  ei({ id: "brew:rg", source: "brew", tags: ["cli", "search"] }),
  ei({ id: "npm:prettier", source: "npm", tags: ["cli"] }),
  ei({ id: "app:Xcode", source: "app", tags: [] }),
];

describe("groupRows", () => {
  it("none → only item rows", () => {
    const rows = groupRows(ITEMS, "none", new Set());
    expect(rows.every((r) => r.type === "item")).toBe(true);
    expect(rows.length).toBe(3);
  });

  it("source → a header per source + its items, alphabetical", () => {
    const rows = groupRows(ITEMS, "source", new Set());
    const headers = rows.filter((r) => r.type === "header") as Extract<typeof rows[number], { type: "header" }>[];
    expect(headers.map((h) => h.key)).toEqual(["app", "brew", "npm"]);
    expect(headers.find((h) => h.key === "brew")!.count).toBe(1);
    // header followed by its item
    const i = rows.findIndex((r) => r.type === "header" && r.key === "npm");
    expect(rows[i + 1]).toMatchObject({ type: "item" });
  });

  it("tag → multi-tag item appears under each tag; untagged last", () => {
    const rows = groupRows(ITEMS, "tag", new Set());
    const headers = (rows.filter((r) => r.type === "header") as Extract<typeof rows[number], { type: "header" }>[]).map((h) => h.key);
    expect(headers).toEqual(["cli", "search", "untagged"]);
    // rg is under both cli and search → counted twice across groups
    const cli = rows.find((r) => r.type === "header" && r.key === "cli") as Extract<typeof rows[number], { type: "header" }>;
    expect(cli.count).toBe(2); // rg + prettier
  });

  it("every row key is unique even in tag mode (multi-tag item)", () => {
    const rows = groupRows(ITEMS, "tag", new Set());
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicate React keys
  });

  it("collapsed group keeps its header but omits items", () => {
    const rows = groupRows(ITEMS, "source", new Set(["brew"]));
    const brewIdx = rows.findIndex((r) => r.type === "header" && r.key === "brew");
    expect(rows[brewIdx]).toMatchObject({ type: "header", collapsed: true });
    // next row is NOT brew's item (it's collapsed) — it's the next header
    expect(rows[brewIdx + 1].type).toBe("header");
  });
});
