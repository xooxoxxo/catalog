import { describe, it, expect } from "vitest";
import { themeToVars, validateTheme, BUILTINS, COLOR_TOKENS, slugify } from "./themes";

describe("themeToVars", () => {
  it("maps all 13 color tokens + fonts to CSS vars", () => {
    const v = themeToVars(BUILTINS[0]);
    for (const t of COLOR_TOKENS) expect(v["--" + t]).toBeTruthy();
    expect(v["--accent"]).toBe("#b23a64");
    expect(v["--ui"]).toContain("Geist");
    expect(v["--radius"]).toBe("10px");
    expect(Object.keys(v).length).toBe(COLOR_TOKENS.length + 3);
  });
});

describe("validateTheme", () => {
  const good = { ...BUILTINS[1], id: "x", name: "Mine" };
  it("accepts a complete theme", () => {
    expect(validateTheme(good).ok).toBe(true);
  });
  it("rejects a missing color token", () => {
    const bad = { ...good, colors: { ...good.colors } } as Record<string, unknown> & { colors: Record<string, string> };
    delete (bad.colors as Record<string, string>).accent;
    expect(validateTheme(bad).ok).toBe(false);
  });
  it("rejects a bad hex", () => {
    expect(validateTheme({ ...good, colors: { ...good.colors, accent: "notacolor" } }).ok).toBe(false);
  });
  it("rejects a bad base", () => {
    expect(validateTheme({ ...good, base: "sepia" }).ok).toBe(false);
  });
  it("defaults fonts + slugs id from name when absent", () => {
    const r = validateTheme({ base: "dark", name: "My Cool Theme", colors: good.colors });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.theme.id).toBe("my-cool-theme"); expect(r.theme.fonts.ui).toContain("Geist"); }
  });
  it("slugify", () => { expect(slugify("Hello World!")).toBe("hello-world"); });
});
