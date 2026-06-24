import type { EnrichedItem, Repo } from "../types";

/** A starred repo counts as "installed" if a catalogue item's homepage points at
 *  github.com/<owner>/<name>, or (fallback) shares the repo's name. */
export function isInstalled(repo: Repo, items: EnrichedItem[]): boolean {
  const slug = `github.com/${repo.owner}/${repo.name}`.toLowerCase();
  const rname = repo.name.toLowerCase();
  return items.some((it) =>
    (it.homepage ? it.homepage.toLowerCase().includes(slug) : false) || it.name.toLowerCase() === rname);
}
