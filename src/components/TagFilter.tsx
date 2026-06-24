import { useState } from "react";
import { X } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";
import { tagFacetOptions } from "../lib/tagFacets";

/** Tag filter panel content — lives inside an IconPopover. Selected tags render
 *  as removable pills above the searchable option list. */
export function TagFilter({ items, selected, onChange }: {
  items: EnrichedItem[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const opts = tagFacetOptions(items).filter((o) => o.tag.toLowerCase().includes(q.toLowerCase()));
  const toggle = (t: string) =>
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);

  return (
    <>
      <input className="si" value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter tags…" autoFocus />
      {selected.length > 0 && (
        <div className="tagpills">
          {selected.map((t) => (
            <span key={t} className="tagpill" onClick={() => toggle(t)}>{t}<X size={11} /></span>
          ))}
        </div>
      )}
      <div className="pop-list">
        {opts.length === 0 && <div className="opt muted">no tags</div>}
        {opts.map((o) => (
          <div key={o.tag} className={`opt ${selected.includes(o.tag) ? "sel" : ""}`} onClick={() => toggle(o.tag)}>
            <span className="cb" />{o.tag}<span className="ct mono">{o.count}</span>
          </div>
        ))}
      </div>
    </>
  );
}
