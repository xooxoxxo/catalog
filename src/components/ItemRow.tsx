import { Tooltip } from "@base-ui/react/tooltip";
import { Star, ArrowUp, CircleNotch } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";

export function ItemRow({
  item, onSelect, onToggleFavorite, style, outdated, active, cursor, describing, id, option, hideTag, suppressCard,
}: {
  item: EnrichedItem;
  onSelect: (it: EnrichedItem) => void;
  onToggleFavorite: (it: EnrichedItem) => void;
  style?: React.CSSProperties;
  outdated?: boolean;
  active?: boolean;
  cursor?: boolean;
  describing?: boolean;
  id?: string;
  /** Suppress the hover card (e.g. while the list is scrolling). */
  suppressCard?: boolean;
  /** Set when rendered inside the listbox so the row carries option semantics. */
  option?: boolean;
  /** When grouping by tag, the group's own tag, suppressed from the row's chips. */
  hideTag?: string;
}) {
  const tags = hideTag ? item.tags.filter((t) => t !== hideTag) : item.tags;
  const MAX_TAGS = 3;
  const shown = tags.slice(0, MAX_TAGS);
  const overflow = tags.length - shown.length;
  return (
    <Tooltip.Root disabled={suppressCard}>
      <Tooltip.Trigger
        render={
          <div
            id={id}
            role={option ? "option" : undefined}
            aria-selected={option ? !!active : undefined}
            className={`item-row ${item.hidden ? "row-hidden" : ""} ${active ? "active" : ""} ${cursor ? "cursor" : ""}`}
            style={style}
            onClick={() => onSelect(item)}
          >
            <button
              type="button"
              className="star"
              tabIndex={-1}
              aria-pressed={!!item.favorite}
              aria-label={`${item.favorite ? "Unfavorite" : "Favorite"} ${item.display_name}`}
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(item); }}
            >
              <Star weight={item.favorite ? "fill" : "regular"} size={14} />
            </button>
            <span className="cell-name">{item.display_name}{outdated ? <span className="up-badge"><ArrowUp weight="bold" size={11} /></span> : null}{describing ? <span className="row-spin"><CircleNotch className="spin" size={12} /></span> : null}</span>
            <span className="cell-desc">
              <span className="desc-text">{item.description ?? ""}</span>
              {shown.length ? (
                <span className="cell-tags">
                  {shown.map((t) => <span key={t} className="list-tag">{t}</span>)}
                  {overflow > 0 ? <span className="list-tag more" title={tags.slice(MAX_TAGS).join(", ")}>+{overflow}</span> : null}
                </span>
              ) : null}
            </span>
          </div>
        }
      />
      <Tooltip.Portal>
        <Tooltip.Positioner className="bui-pos" side="bottom" align="start" sideOffset={6}>
          <Tooltip.Popup className="row-card">
            <div className="row-card-row"><span>Source</span><b>{item.source}</b></div>
            <div className="row-card-row"><span>Version</span><b className="mono">{item.version ?? "—"}</b></div>
            {item.exec_path ? <div className="row-card-row"><span>Path</span><b className="mono">{item.exec_path}</b></div> : null}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
