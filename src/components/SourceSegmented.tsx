import type { EnrichedItem } from "../types";

/** Source filter panel — single-select vertical list inside an IconPopover. */
export function SourceSegmented({
  items,
  active,
  onChange,
}: {
  items: EnrichedItem[];
  active: string | null; // null = All
  onChange: (src: string | null) => void;
}) {
  const sources = Array.from(new Set(items.map((i) => i.source))).sort();
  const count = (s: string) => items.filter((i) => i.source === s).length;
  return (
    <div className="pop-list">
      <div className={`opt ${active === null ? "sel" : ""}`} onClick={() => onChange(null)}>
        <span className="cb" />All<span className="ct mono">{items.length}</span>
      </div>
      {sources.map((s) => (
        <div key={s} className={`opt ${active === s ? "sel" : ""}`} onClick={() => onChange(s)}>
          <span className="cb" />{s}<span className="ct mono">{count(s)}</span>
        </div>
      ))}
    </div>
  );
}
