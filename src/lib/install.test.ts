import { describe, it, expect } from "vitest";
import { installCommand } from "./install";
import type { EnrichedItem } from "../types";

function ei(o: Partial<EnrichedItem>): EnrichedItem {
  return { id: "brew:eza", name: "eza", source: "brew", source_detail: null, version: null,
    exec_path: null, homepage: null, raw_desc: null, installed_on_request: null, display_name: "eza",
    description: null, tags: [], favorite: false, hidden: false, notes: "", llm_confirmed: false, has_enrichment: false, ...o };
}

describe("installCommand", () => {
  it("brew formula uses the id token", () => {
    expect(installCommand(ei({ id: "brew:eza", source: "brew" }))).toBe("brew install eza");
  });
  it("cask uses --cask + token (not display name)", () => {
    expect(installCommand(ei({ id: "cask:ghostty", source: "cask", name: "Ghostty" }))).toBe("brew install --cask ghostty");
  });
  it("npm/cargo/uv/pipx/bun use the name", () => {
    expect(installCommand(ei({ id: "npm:typescript", source: "npm", name: "typescript" }))).toBe("npm install -g typescript");
    expect(installCommand(ei({ id: "cargo:ripgrep", source: "cargo", name: "ripgrep" }))).toBe("cargo install ripgrep");
    expect(installCommand(ei({ id: "uv:ruff", source: "uv", name: "ruff" }))).toBe("uv tool install ruff");
    expect(installCommand(ei({ id: "pipx:poetry", source: "pipx", name: "poetry" }))).toBe("pipx install poetry");
    expect(installCommand(ei({ id: "bun:cowsay", source: "bun", name: "cowsay" }))).toBe("bun add -g cowsay");
  });
  it("returns null where there's no canonical install command", () => {
    expect(installCommand(ei({ id: "orphan:/usr/local/bin/x", source: "orphan" }))).toBeNull();
    expect(installCommand(ei({ id: "app:com.x", source: "app" }))).toBeNull();
    expect(installCommand(ei({ id: "mas:497799835", source: "mas" }))).toBeNull();
    expect(installCommand(ei({ id: "go:gopls", source: "go" }))).toBeNull();
  });
});
