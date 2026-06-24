import type { EnrichedItem } from "../types";
import { idToken } from "./idToken";

const tok = (it: EnrichedItem) => idToken(it.id);

/** Pure: a batched shell script to upgrade the given (outdated) items, grouped per manager. */
export function buildUpdateScript(items: EnrichedItem[]): string {
  const formulae = items.filter((i) => i.source === "brew").map(tok);
  const casks = items.filter((i) => i.source === "cask").map(tok);
  const npm = items.filter((i) => i.source === "npm").map((i) => `${i.name}@latest`);
  const mas = items.filter((i) => i.source === "mas").map(tok);
  const lines: string[] = [];
  if (formulae.length) lines.push(`brew upgrade ${formulae.join(" ")}`);
  if (casks.length) lines.push(`brew upgrade --cask ${casks.join(" ")}`);
  if (npm.length) lines.push(`npm install -g ${npm.join(" ")}`);
  if (mas.length) lines.push(`mas upgrade ${mas.join(" ")}`);
  return lines.join("\n");
}
