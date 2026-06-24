import type { EnrichedItem } from "../types";
import { idToken } from "./idToken";
export function upgradeCommand(item: EnrichedItem): string | null {
  const token = idToken(item.id);
  switch (item.source) {
    case "brew": return `brew upgrade ${token}`;
    case "cask": return `brew upgrade --cask ${token}`;
    case "npm": return `npm install -g ${item.name}@latest`;
    case "mas": return `mas upgrade ${token}`;
    default: return null;
  }
}
