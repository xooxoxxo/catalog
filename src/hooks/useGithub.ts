import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Repo, GithubStatus } from "../types";

/**
 * GitHub connection + starred-repo browsing. Status and stars are fetched once
 * and cached; status is re-checked on an auth error (token may be revoked).
 */
export function useGithub() {
  const [readmeRepo, setReadmeRepo] = useState<Repo | null>(null);
  // Stars live here so they survive closing the sheet — fetched once on first
  // open, then only on manual Refresh (no reload on every reopen).
  const [stars, setStars] = useState<Repo[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [starsLoaded, setStarsLoaded] = useState(false);
  const [starsLoading, setStarsLoading] = useState(false);
  const [ghStatus, setGhStatus] = useState<GithubStatus | null>(null);
  const [ghStatusLoaded, setGhStatusLoaded] = useState(false);

  const loadGhStatus = useCallback(async () => {
    try {
      setGhStatus(await invoke<GithubStatus>("gh_status"));
    } catch {
      setGhStatus({ connected: false, login: null, avatar_url: null });
    } finally {
      setGhStatusLoaded(true);
    }
  }, []);

  const loadStars = useCallback(async () => {
    setStarsLoading(true);
    try {
      const r = await invoke<Repo[]>("gh_list_stars");
      setStars(r);
      setStarred(new Set(r.map((x) => x.full_name)));
    } catch {
      setStars([]);
    } finally {
      setStarsLoading(false);
      setStarsLoaded(true);
    }
  }, []);

  const toggleStar = useCallback(
    async (r: Repo) => {
      const on = starred.has(r.full_name);
      setStarred((prev) => {
        const n = new Set(prev);
        on ? n.delete(r.full_name) : n.add(r.full_name);
        return n;
      });
      try {
        await invoke(on ? "gh_unstar" : "gh_star", { owner: r.owner, repo: r.name });
      } catch {
        // revert + re-verify the connection (token may have been revoked)
        setStarred((prev) => {
          const n = new Set(prev);
          on ? n.add(r.full_name) : n.delete(r.full_name);
          return n;
        });
        loadGhStatus();
      }
    },
    [starred, loadGhStatus],
  );

  return {
    ghStatus,
    ghStatusLoaded,
    loadGhStatus,
    stars,
    starred,
    starsLoaded,
    starsLoading,
    loadStars,
    toggleStar,
    readmeRepo,
    setReadmeRepo,
  };
}
