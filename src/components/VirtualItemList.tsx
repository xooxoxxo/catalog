import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";
import type { ListRow } from "../lib/grouping";
import { ItemRow } from "./ItemRow";

const ROW_HEIGHT = 34;
const HEADER_HEIGHT = 34;

export function VirtualItemList({
  rows, onSelect, onToggleFavorite, onToggleGroup, updates, selected, describing,
}: {
  rows: ListRow[];
  onSelect: (it: EnrichedItem) => void;
  onToggleFavorite: (it: EnrichedItem) => void;
  onToggleGroup: (key: string) => void;
  updates: Record<string, { current: string; latest: string }>;
  selected?: EnrichedItem | null;
  describing?: Set<string>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Drop the hover card the instant scrolling starts (re-enable when it stops),
  // so it doesn't ride along with the scrolled rows.
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<number | null>(null);
  const onScroll = useCallback(() => {
    setScrolling(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => setScrolling(false), 160);
  }, []);
  // Keyboard cursor: an index into `rows`, distinct from `selected` (the row
  // opened in the sidebar). Exposed via aria-activedescendant rather than DOM
  // focus, because virtualization unmounts off-screen rows and a roving
  // tabIndex would lose focus on scroll.
  const [cursor, setCursor] = useState(-1);
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].type === "header" ? HEADER_HEIGHT : ROW_HEIGHT),
    overscan: 12,
  });

  const move = useCallback((next: number) => {
    if (!rows.length) return;
    const clamped = Math.max(0, Math.min(rows.length - 1, next));
    setCursor(clamped);
    virt.scrollToIndex(clamped, { align: "auto" });
  }, [rows.length, virt]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const at = cursor < 0 ? -1 : cursor;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); move(at + 1); break;
      case "ArrowUp": e.preventDefault(); move(at < 0 ? 0 : at - 1); break;
      case "Home": e.preventDefault(); move(0); break;
      case "End": e.preventDefault(); move(rows.length - 1); break;
      case "Enter":
      case " ": {
        const row = rows[cursor];
        if (!row) break;
        e.preventDefault();
        if (row.type === "header") onToggleGroup(row.key);
        else onSelect(row.item);
        break;
      }
      case "f":
      case "F": {
        const row = rows[cursor];
        if (row?.type === "item") { e.preventDefault(); onToggleFavorite(row.item); }
        break;
      }
    }
  };

  const activeId = cursor >= 0 && cursor < rows.length ? `vil-row-${cursor}` : undefined;

  return (
    <motion.div
      className="list-scroll"
      ref={parentRef}
      onScroll={onScroll}
      role="listbox"
      tabIndex={0}
      aria-label="Installed tools"
      aria-activedescendant={activeId}
      onKeyDown={onKeyDown}
      onFocus={() => { if (cursor < 0 && rows.length) setCursor(0); }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{ height: virt.getTotalSize(), position: "relative", width: "100%" }}>
        {virt.getVirtualItems().map((v) => {
          const row = rows[v.index];
          const pos: React.CSSProperties = { position: "absolute", top: 0, left: 0, width: "100%", height: v.size, transform: `translateY(${v.start}px)` };
          const id = `vil-row-${v.index}`;
          const isCursor = v.index === cursor;
          if (row.type === "header") {
            return (
              <button
                key={row.key}
                id={id}
                className={`grp-head${isCursor ? " cursor" : ""}`}
                style={pos}
                tabIndex={-1}
                aria-expanded={!row.collapsed}
                onClick={() => { setCursor(v.index); onToggleGroup(row.key); }}
              >
                {row.collapsed ? <CaretRight size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
                <span className="grp-label">{row.label}</span>
                <span className="grp-count mono">{row.count}</span>
              </button>
            );
          }
          const it = row.item;
          return (
            <ItemRow
              key={row.key}
              id={id}
              option
              hideTag={row.group}
              item={it}
              onSelect={(item) => { setCursor(v.index); onSelect(item); }}
              onToggleFavorite={onToggleFavorite}
              outdated={!!updates[it.id]}
              active={selected?.id === it.id}
              cursor={isCursor}
              describing={describing?.has(it.id)}
              suppressCard={scrolling}
              style={pos}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
