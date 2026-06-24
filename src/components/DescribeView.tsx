import { useState, useRef } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { Sparkle, MagnifyingGlass, X } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";
import { ProgressBar } from "./ProgressBar";

type Filter = "nodesc" | "notags" | "all";
const FILTERS: { k: Filter; label: string }[] = [
  { k: "nodesc", label: "No description" },
  { k: "notags", label: "No tags" },
  { k: "all", label: "All" },
];
const matches = (f: Filter, i: EnrichedItem) =>
  f === "all" ? true : f === "notags" ? i.tags.length === 0 : !i.description;

/** Pick items to describe: filter (default un-described), search, select the filtered set. */
export function DescribeView({ items, onDescribe, onStop, busy, progress }: {
  items: EnrichedItem[];
  onDescribe: (ids: string[]) => void;
  onStop: () => void;
  busy: boolean;
  progress: { done: number; total: number } | null;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("nodesc");
  const [sel, setSel] = useState<Set<string>>(() => new Set(items.filter((i) => !i.description).map((i) => i.id)));
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<number | null>(null);
  const onScroll = () => {
    setScrolling(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => setScrolling(false), 160);
  };

  // While a batch runs, take over the whole sheet with progress — the list is hidden.
  if (busy) {
    return (
      <div className="describe-view describe-busy">
        {progress && <div style={{ width: "100%" }}><ProgressBar done={progress.done} total={progress.total} /></div>}
        <p className="status">Describing {progress?.total ?? ""} items… you can keep using catalog — we&apos;ll notify you when it&apos;s done.</p>
        <button className="ghost" onClick={onStop}><X size={14} weight="bold" /> Stop</button>
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) =>
    matches(filter, i) &&
    (!needle || i.display_name.toLowerCase().includes(needle) || (i.description ?? "").toLowerCase().includes(needle)));
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="describe-view">
      <div className="dsel-head">
        <div className="search">
          <MagnifyingGlass size={16} weight="bold" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter items…"
            autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} />
        </div>
        <button className="primary" disabled={sel.size === 0} onClick={() => onDescribe([...sel])}>
          <Sparkle size={14} style={{ display: "inline", marginRight: "5px" }} />Describe {sel.size}
        </button>
      </div>

      <div className="dsel-bar">
        <div className="dsel-filters">
          {FILTERS.map((f) => (
            <button key={f.k} className={`chip ${filter === f.k ? "on" : ""}`} onClick={() => setFilter(f.k)}>{f.label}</button>
          ))}
        </div>
        <button className="link-chip" onClick={() => setSel(new Set(shown.map((i) => i.id)))}>Select all</button>
        <button className="link-chip" onClick={() => setSel(new Set())}>Deselect all</button>
        <span className="dsel-count">{sel.size} selected</span>
      </div>

      <div className="describe-list" onScroll={onScroll}>
        {shown.map((c) => (
          <Tooltip.Root key={c.id} disabled={scrolling}>
            <Tooltip.Trigger
              render={
                <div className={`dsel ${sel.has(c.id) ? "sel" : ""}`} onClick={() => toggle(c.id)}>
                  <span className="cb" />
                  <span className="dsel-name">{c.display_name}</span>
                  <span className="dsel-desc">{c.description || "no description yet"}</span>
                </div>
              }
            />
            <Tooltip.Portal>
              <Tooltip.Positioner className="bui-pos" side="bottom" align="start" sideOffset={6}>
                <Tooltip.Popup className="row-card">
                  <div className="row-card-row"><span>Source</span><b>{c.source}</b></div>
                  <div className="row-card-row"><span>Version</span><b className="mono">{c.version ?? "—"}</b></div>
                  {c.exec_path ? <div className="row-card-row"><span>Path</span><b className="mono">{c.exec_path}</b></div> : null}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
        {shown.length === 0 && <div className="empty"><span>No items match.</span></div>}
      </div>
    </div>
  );
}
