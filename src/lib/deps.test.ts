import { describe, it, expect } from "vitest";
import { presentNames, missingNames, missingKey, updatesDisabled, securityDisabled } from "./deps";
import type { Dep } from "../types";

const dep = (name: string, present: boolean): Dep => ({ name, present, powers: "x", install: "y" });

describe("deps helpers", () => {
  it("presentNames / missingNames / missingKey", () => {
    const deps = [dep("brew", true), dep("mas", false), dep("go", false)];
    expect([...presentNames(deps)]).toEqual(["brew"]);
    expect(missingNames(deps)).toEqual(["go", "mas"]); // sorted
    expect(missingKey(deps)).toBe("go,mas");
    expect(missingKey([dep("brew", true)])).toBe("");
  });

  it("updatesDisabled only when brew+npm+mas all absent", () => {
    expect(updatesDisabled(new Set())).toBe(true);
    expect(updatesDisabled(new Set(["go"]))).toBe(true);
    expect(updatesDisabled(new Set(["npm"]))).toBe(false);
    expect(updatesDisabled(new Set(["brew"]))).toBe(false);
  });

  it("securityDisabled when offline or no OSV manager", () => {
    expect(securityDisabled(new Set(["npm"]), false)).toBe(true);   // offline
    expect(securityDisabled(new Set(["brew", "go"]), true)).toBe(true); // no osv tool
    expect(securityDisabled(new Set(["cargo"]), true)).toBe(false);
    expect(securityDisabled(new Set(["npm"]), true)).toBe(false);
  });
});
