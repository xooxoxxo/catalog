import { describe, it, expect } from "vitest";
import { buildBrewfile, buildRestoreScript, buildReport, buildSbom } from "./exportFormats";
import type { EnrichedItem } from "../types";

function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return {
    id: "brew:x", name: "x", source: "brew", source_detail: null, version: null,
    exec_path: null, homepage: null, raw_desc: null, installed_on_request: null,
    display_name: "x", description: null, tags: [], favorite: false, hidden: false,
    notes: "", llm_confirmed: false, has_enrichment: false, ...o,
  };
}

const SAMPLE: EnrichedItem[] = [
  ei({ id: "brew:ripgrep", name: "ripgrep", source: "brew", display_name: "ripgrep", version: "14.1" }),
  ei({ id: "cask:ghostty", name: "Ghostty", source: "cask", display_name: "Ghostty", version: "1.3" }),
  ei({ id: "mas:497799835", name: "Xcode", source: "mas", display_name: "Xcode", version: "16.2" }),
  ei({ id: "npm:prettier", name: "prettier", source: "npm", display_name: "prettier", version: "3.8" }),
  ei({ id: "npm:sanity", name: "sanity", source: "npm", display_name: "sanity", version: "3.9" }),
  ei({ id: "cargo:rg", name: "rg", source: "cargo", display_name: "rg", version: "14" }),
  ei({ id: "pipx:poetry", name: "poetry", source: "pipx", display_name: "poetry", version: "1.8" }),
  ei({ id: "go:gopls", name: "gopls", source: "go", display_name: "gopls" }),
  ei({ id: "app:com.apple.dt.Xcode", name: "Xcode", source: "app", display_name: "Xcode", version: "16.2" }),
];

describe("buildBrewfile", () => {
  it("formats brew/cask/mas lines, ignores other sources", () => {
    const bf = buildBrewfile(SAMPLE, "2026-06-08");
    expect(bf).toContain(`brew "ripgrep"`);
    expect(bf).toContain(`cask "ghostty"`);
    expect(bf).toContain(`mas "Xcode", id: 497799835`);
    expect(bf).not.toContain("prettier");
    expect(bf).toContain("# catalog export — 2026-06-08");
  });
  it("omits empty kinds", () => {
    const bf = buildBrewfile([SAMPLE[3]], "2026-06-08"); // npm only
    expect(bf).not.toContain("brew \"");
    expect(bf).not.toContain("cask \"");
  });
  it("keys on id prefix — a merged App Store app (source 'app', id mas:) still emits a mas line; a real app does not", () => {
    const merged = ei({ id: "mas:497799835", name: "Xcode", source: "app", display_name: "Xcode", version: "16.2", exec_path: "/Applications/Xcode.app" });
    const realApp = ei({ id: "app:org.mozilla.firefox", name: "Firefox", source: "app", display_name: "Firefox" });
    const bf = buildBrewfile([merged, realApp], "2026-06-09");
    expect(bf).toContain(`mas "Xcode", id: 497799835`);
    expect(bf).not.toContain("Firefox");
  });
});

describe("buildRestoreScript", () => {
  it("has shebang + safety + brew bundle + grouped installs", () => {
    const sh = buildRestoreScript(SAMPLE, "2026-06-08");
    expect(sh.startsWith("#!/usr/bin/env bash\nset -euo pipefail")).toBe(true);
    expect(sh).toContain(`brew bundle --file "$(dirname "$0")/Brewfile"`);
    expect(sh).toContain("npm i -g prettier sanity");
    expect(sh).toContain("cargo install rg");
    expect(sh).toContain("pipx install poetry");
    expect(sh).not.toContain("gopls"); // go not scriptable
  });
  it("omits brew bundle when no brew/cask/mas selected", () => {
    const sh = buildRestoreScript([SAMPLE[3]], "2026-06-08"); // npm only
    expect(sh).not.toContain("brew bundle");
    expect(sh).toContain("npm i -g prettier");
  });
});

describe("buildReport", () => {
  it("sections with counts, install blocks, manual notes, and N of M", () => {
    const md = buildReport(SAMPLE, "2026-06-08", 100);
    expect(md).toContain("Selected 9 of 100 items.");
    expect(md).toContain("## Homebrew formulae (1)");
    expect(md).toContain("## npm — global (2)");
    expect(md).toContain("npm i -g prettier sanity");
    expect(md).toContain("## Go binaries (1) — manual");
    expect(md).toContain("## Applications (1) — manual");
    expect(md).toContain("- gopls");
  });
});

describe("buildSbom", () => {
  it("emits CycloneDX 1.5 with a component per item and ecosystem purls", () => {
    const json = buildSbom(SAMPLE, "2026-06-09T10:00:00.000Z");
    const bom = JSON.parse(json);
    expect(bom.bomFormat).toBe("CycloneDX");
    expect(bom.specVersion).toBe("1.5");
    expect(bom.metadata.timestamp).toBe("2026-06-09T10:00:00.000Z");
    expect(bom.components.length).toBe(SAMPLE.length);
    const find = (name: string) => bom.components.find((c: { name: string }) => c.name === name);
    expect(find("prettier").purl).toBe("pkg:npm/prettier@3.8");
    expect(find("rg").purl).toBe("pkg:cargo/rg@14");
    expect(find("poetry").purl).toBe("pkg:pypi/poetry@1.8");
    expect(find("prettier").type).toBe("library");
    // app source → application, no purl
    expect(find("Xcode").type).toBe("application");
    expect(find("Xcode").purl).toBeUndefined();
  });
});
