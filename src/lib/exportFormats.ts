import type { EnrichedItem } from "../types";
import { idToken } from "./idToken";

const token = (it: EnrichedItem) => idToken(it.id);
// Brewfile-restorable kinds are keyed by id PREFIX, not display source: App Store
// apps are merged into the catalogue as source "app" but keep their `mas:<id>` id.
const isKind = (it: EnrichedItem, kind: string) => it.id.startsWith(`${kind}:`);

/** Brewfile for brew/cask/mas (the brew-bundle-restorable kinds). */
export function buildBrewfile(items: EnrichedItem[], date: string): string {
  const brews = items.filter((i) => isKind(i, "brew")).map((i) => `brew "${i.name}"`).sort();
  const casks = items.filter((i) => isKind(i, "cask")).map((i) => `cask "${token(i)}"`).sort();
  const mas = items.filter((i) => isKind(i, "mas")).map((i) => `mas "${i.name}", id: ${token(i)}`).sort();
  const lines = [`# catalog export — ${date}`];
  for (const group of [brews, casks, mas]) {
    if (group.length) lines.push("", ...group);
  }
  return lines.join("\n") + "\n";
}

/** Runnable restore script: brew bundle + the scriptable language managers. */
export function buildRestoreScript(items: EnrichedItem[], date: string): string {
  const names = (src: string) => items.filter((i) => i.source === src).map((i) => i.name).sort();
  const lines = ["#!/usr/bin/env bash", "set -euo pipefail", `# catalog restore — ${date}`, ""];
  if (items.some((i) => isKind(i, "brew") || isKind(i, "cask") || isKind(i, "mas"))) {
    lines.push(`brew bundle --file "$(dirname "$0")/Brewfile"`);
  }
  const npm = names("npm");
  if (npm.length) lines.push(`npm i -g ${npm.join(" ")}`);
  const cargo = names("cargo");
  if (cargo.length) lines.push(`cargo install ${cargo.join(" ")}`);
  for (const t of names("uv")) lines.push(`uv tool install ${t}`);
  for (const t of names("pipx")) lines.push(`pipx install ${t}`);
  return lines.join("\n") + "\n";
}

interface Section { src: string; label: string; install?: (names: string[]) => string; manual?: string }
const SECTIONS: Section[] = [
  { src: "brew", label: "Homebrew formulae", install: () => "brew bundle --file Brewfile" },
  { src: "cask", label: "Homebrew casks", install: () => "brew bundle --file Brewfile" },
  { src: "mas", label: "Mac App Store", install: () => "brew bundle --file Brewfile" },
  { src: "npm", label: "npm — global", install: (n) => `npm i -g ${n.join(" ")}` },
  { src: "cargo", label: "cargo", install: (n) => `cargo install ${n.join(" ")}` },
  { src: "uv", label: "uv tools", install: (n) => n.map((x) => `uv tool install ${x}`).join("\n") },
  { src: "pipx", label: "pipx", install: (n) => n.map((x) => `pipx install ${x}`).join("\n") },
  { src: "go", label: "Go binaries", manual: "needs the module path to reinstall" },
  { src: "app", label: "Applications", manual: "cask or App Store; not script-restorable" },
  { src: "orphan", label: "Orphan binaries", manual: "loose binaries; no package manager" },
];

/** Human-readable markdown report covering every selected item. */
export function buildReport(items: EnrichedItem[], date: string, total: number): string {
  const out: string[] = [`# catalog export — ${date}`, "", `Selected ${items.length} of ${total} items.`];
  for (const s of SECTIONS) {
    const group = items.filter((i) => i.source === s.src);
    if (!group.length) continue;
    out.push("", `## ${s.label} (${group.length})${s.manual ? " — manual" : ""}`);
    for (const it of [...group].sort((a, b) => a.display_name.localeCompare(b.display_name))) {
      out.push(`- ${it.display_name}${it.version ? ` · ${it.version}` : ""}`);
    }
    if (s.manual) out.push(`> ${s.manual}`);
    if (s.install) {
      const names = group.map((i) => i.name).sort();
      out.push("", "```bash", s.install(names), "```");
    }
  }
  return out.join("\n") + "\n";
}

/** CycloneDX 1.5 SBOM of the given items. `timestamp` = ISO string (caller passes it). */
export function buildSbom(items: EnrichedItem[], timestamp: string): string {
  const PURL: Record<string, string> = { npm: "npm", bun: "npm", cargo: "cargo", pipx: "pypi", uv: "pypi", go: "golang" };
  const LIB = ["npm", "bun", "cargo", "pipx", "uv", "go"];
  const components = items.map((it) => {
    const c: Record<string, unknown> = { type: LIB.includes(it.source) ? "library" : "application", name: it.name };
    if (it.version) c.version = it.version;
    const eco = PURL[it.source];
    if (eco && it.version) c.purl = `pkg:${eco}/${it.name}@${it.version}`;
    return c;
  });
  const bom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: { timestamp, tools: [{ vendor: "catalog", name: "catalog" }] },
    components,
  };
  return JSON.stringify(bom, null, 2) + "\n";
}
