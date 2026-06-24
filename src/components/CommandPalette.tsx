import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";
import { filterCommands, type PaletteCommand } from "../lib/palette";
import { filterItems } from "../lib/filter";
import { clamp } from "../lib/math";

export function CommandPalette({ open, onClose, commands, items, onPickItem }: {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
  items: EnrichedItem[];
  onPickItem: (it: EnrichedItem) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setSel(0); inputRef.current?.focus(); } }, [open]);

  if (!open) return null;

  const cmds = filterCommands(commands, q);
  const its = filterItems(items, q).slice(0, 8);
  const rows: ({ kind: "cmd"; c: PaletteCommand } | { kind: "item"; it: EnrichedItem })[] = [
    ...cmds.map((c) => ({ kind: "cmd" as const, c })),
    ...its.map((it) => ({ kind: "item" as const, it })),
  ];
  const clampedSel = clamp(sel, 0, rows.length - 1);

  const activate = (i: number) => {
    const r = rows[i];
    if (!r) return;
    onClose();
    if (r.kind === "cmd") r.c.run(); else onPickItem(r.it);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(rows.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); activate(clampedSel); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  let idx = -1;
  const rowProps = (i: number) => ({
    className: `pal-row ${i === clampedSel ? "active" : ""}`,
    onMouseEnter: () => setSel(i),
    onClick: () => activate(i),
  });

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="pal-input-wrap">
          <MagnifyingGlass size={16} weight="bold" />
          <input ref={inputRef} className="pal-input" value={q} placeholder="Search tools and commands…"
            onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}
            autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} />
        </div>
        <div className="pal-list">
          {rows.length === 0 && <div className="pal-empty">No matches</div>}
          {cmds.length > 0 && <div className="pal-group">Commands</div>}
          {cmds.map((c) => { idx++; const i = idx; return (
            <div key={`c-${c.id}`} {...rowProps(i)}><span>{c.label}</span>{c.hint && <span className="pal-hint">{c.hint}</span>}</div>
          ); })}
          {its.length > 0 && <div className="pal-group">Items</div>}
          {its.map((it) => { idx++; const i = idx; return (
            <div key={`i-${it.id}`} {...rowProps(i)}><span>{it.display_name}</span><span className="pal-hint mono">{it.source}</span></div>
          ); })}
        </div>
      </div>
    </div>
  );
}
