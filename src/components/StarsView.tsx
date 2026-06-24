import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Star, GithubLogo, BookOpen, ArrowsClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import type { EnrichedItem, Repo } from "../types";
import { isInstalled } from "../lib/crossref";
import { IconButton } from "./IconButton";

/** Presentational — stars state lives in App so it survives closing the sheet. */
export function StarsView({ items, repos, starred, loading, connected, onRefresh, onToggle, onReadme }: {
  items: EnrichedItem[];
  repos: Repo[];
  starred: Set<string>;
  loading: boolean;
  connected: boolean;
  onRefresh: () => void;
  onToggle: (r: Repo) => void;
  onReadme: (repo: Repo) => void;
}) {
  const [q, setQ] = useState("");
  const open = (url: string) => invoke("open_url", { url }).catch(() => {});

  if (!connected && !loading) {
    return <div className="empty"><div className="big">Not connected</div><span>Connect GitHub in Settings to see your stars.</span></div>;
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? repos.filter((r) =>
        r.full_name.toLowerCase().includes(needle) ||
        (r.description ?? "").toLowerCase().includes(needle) ||
        (r.language ?? "").toLowerCase().includes(needle))
    : repos;

  return (
    <>
      <div className="search">
        <MagnifyingGlass size={16} weight="bold" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter stars…"
          autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} />
        {repos.length > 0 && (
          <span className="count">{needle ? `${shown.length} / ${repos.length}` : repos.length} starred</span>
        )}
        <button className="search-refresh" onClick={onRefresh} disabled={loading} title="Refresh stars" aria-label="Refresh stars">
          <ArrowsClockwise size={15} weight="bold" className={loading ? "spin" : ""} />
        </button>
      </div>

      {loading && repos.length === 0 && <div className="empty"><span>Loading your stars…</span></div>}
      {!loading && repos.length === 0 && connected && <div className="empty"><div className="big">No stars yet</div></div>}
      {repos.length > 0 && shown.length === 0 && <div className="empty"><span>No stars match “{q}”.</span></div>}

      <div className="star-list">
        {shown.map((r) => {
          const installed = isInstalled(r, items);
          const isOn = starred.has(r.full_name);
          return (
            <div key={r.full_name} className="star-row">
              <img className="star-avatar" src={`https://github.com/${r.owner}.png?size=40`} alt="" />
              <div className="star-main">
                <div className="star-name"><b>{r.owner}/{r.name}</b>{installed && <span className="star-inst">installed</span>}</div>
                {r.description && <div className="star-desc">{r.description}</div>}
                <div className="star-meta">{r.language && <span>{r.language}</span>}<span className="mono">★ {r.stars.toLocaleString()}</span></div>
              </div>
              <div className="star-actions">
                <IconButton label={isOn ? "Unstar" : "Star"} onClick={() => onToggle(r)} className={isOn ? "on" : ""}>
                  <Star size={15} weight={isOn ? "fill" : "regular"} />
                </IconButton>
                <IconButton label="View README" onClick={() => onReadme(r)}><BookOpen size={16} /></IconButton>
                <IconButton label="Open on GitHub" onClick={() => open(r.html_url)}><GithubLogo size={16} /></IconButton>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
