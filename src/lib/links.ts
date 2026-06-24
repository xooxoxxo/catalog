import type { EnrichedItem } from "../types";
import { idToken } from "./idToken";

export interface ItemLink {
  label: string;
  url: string;
}

/** Pure: external links to help understand an item. */
export function itemLinks(item: EnrichedItem): ItemLink[] {
  const links: ItemLink[] = [];
  const enc = encodeURIComponent(item.name);
  const token = idToken(item.id);

  if (item.homepage) links.push({ label: "Homepage", url: item.homepage });
  if (item.source === "brew") links.push({ label: "Homebrew formula", url: `https://formulae.brew.sh/formula/${token}` });
  if (item.source === "cask") links.push({ label: "Homebrew cask", url: `https://formulae.brew.sh/cask/${token}` });

  links.push({ label: "context7 docs", url: `https://context7.com/?q=${enc}` }); // best-effort URL; adjust if context7 changes scheme
  return links;
}
