import type { EnrichedItem } from "../types";
import { idToken } from "./idToken";

/** Pure: the shell command to (re)install this item, or null when there's no canonical one. */
export function installCommand(item: EnrichedItem): string | null {
  const token = idToken(item.id);
  switch (item.source) {
    case "brew": return `brew install ${token}`;
    case "cask": return `brew install --cask ${token}`;
    case "npm": return `npm install -g ${item.name}`;
    case "cargo": return `cargo install ${item.name}`;
    case "uv": return `uv tool install ${item.name}`;
    case "pipx": return `pipx install ${item.name}`;
    case "bun": return `bun add -g ${item.name}`;
    default: return null; // go / app / mas / orphan: no canonical install command
  }
}
