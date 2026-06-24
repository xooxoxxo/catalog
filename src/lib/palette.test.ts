import { describe, it, expect } from "vitest";
import { filterCommands, type PaletteCommand } from "./palette";

const cmds: PaletteCommand[] = [
  { id: "updates", label: "Check for updates", run: () => {} },
  { id: "themes", label: "Themes", hint: "appearance", run: () => {} },
];

describe("filterCommands", () => {
  it("empty query returns all", () => { expect(filterCommands(cmds, "  ").length).toBe(2); });
  it("matches label case-insensitively", () => {
    expect(filterCommands(cmds, "UPDATE").map((c) => c.id)).toEqual(["updates"]);
  });
  it("matches hint", () => { expect(filterCommands(cmds, "appearance").map((c) => c.id)).toEqual(["themes"]); });
  it("no match returns empty", () => { expect(filterCommands(cmds, "zzz")).toEqual([]); });
});
