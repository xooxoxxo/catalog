import type { RefObject } from "react";
import { MagnifyingGlass, Heartbeat, Gear, Moon, Sun, ArrowsClockwise, HardDrive, DownloadSimple, ShieldWarning, GithubLogo, Funnel, Tag, Eye, Rows, StackSimple, Hash, Sparkle } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";
import type { GroupBy } from "../lib/grouping";
import { needsEnrichment, type Facets } from "../lib/facets";
import { Popover } from "@base-ui/react/popover";
import { IconButton } from "./IconButton";
import { IconPopover } from "./IconPopover";
import { SourceSegmented } from "./SourceSegmented";
import { StatusToggles } from "./StatusToggles";
import { TagFilter } from "./TagFilter";

const GROUP_OPTS: { v: GroupBy; label: string }[] = [
  { v: "none", label: "Flat" }, { v: "source", label: "Source" }, { v: "tag", label: "Tag" },
];
function groupIcon(g: GroupBy) {
  if (g === "source") return <StackSimple size={16} weight="bold" />;
  if (g === "tag") return <Hash size={16} weight="bold" />;
  return <Rows size={16} />;
}

export function Toolbar({
  q, onQ, inputRef, status,
  items, facets, onFacets, groupBy, onGroupBy, showHidden, onShowHidden, hiddenCount,
  onDescribeAll, describeEnabled, describeReason, describingAll,
  updatesCount, onUpdates, updatesDisabled,
  onDisk, securityAlert, onSecurity, securityDisabled, onStars, onExport, onDoctor, onSettings, isDark, onToggleTheme,
}: {
  q: string; onQ: (v: string) => void; inputRef?: RefObject<HTMLInputElement | null>; status: string;
  items: EnrichedItem[];
  facets: Facets; onFacets: (f: Facets) => void;
  groupBy: GroupBy; onGroupBy: (g: GroupBy) => void;
  showHidden: boolean; onShowHidden: (v: boolean) => void; hiddenCount: number;
  onDescribeAll: () => void; describeEnabled: boolean; describeReason: string; describingAll: boolean;
  updatesCount: number; onUpdates: () => void; updatesDisabled: boolean;
  onDisk: () => void;
  securityAlert: boolean; onSecurity: () => void; securityDisabled: boolean;
  onStars: () => void; onExport: () => void; onDoctor: () => void; onSettings: () => void;
  isDark: boolean; onToggleTheme: () => void;
}) {
  const statusActive = facets.outdatedOnly || facets.needsEnrichmentOnly || showHidden;
  return (
    <div className="toolbar">
      <div className="search">
        <MagnifyingGlass size={16} weight="bold" />
        <input ref={inputRef} value={q} onChange={(e) => onQ(e.target.value)} placeholder="search installed tools…"
          autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} />
        <span className="count">{status}</span>
      </div>

      <div className="tb-controls">
      <div className="tb-group">
        <IconPopover icon={<Funnel size={16} />} label="Source" active={facets.sources.length > 0}>
          <SourceSegmented items={items} active={facets.sources[0] ?? null}
            onChange={(src) => onFacets({ ...facets, sources: src ? [src] : [] })} />
        </IconPopover>
        <IconPopover icon={groupIcon(groupBy)} label="Group by">
          <span className="pop-cap">Group by</span>
          <div className="pop-list">
            {GROUP_OPTS.map((o) => (
              <div key={o.v} className={`opt ${groupBy === o.v ? "sel" : ""}`} onClick={() => onGroupBy(o.v)}>
                <span className="cb" />{o.label}
              </div>
            ))}
          </div>
        </IconPopover>
        <IconPopover icon={<Tag size={16} />} label="Tags" badge={facets.tags.length}>
          <TagFilter items={items} selected={facets.tags} onChange={(tags) => onFacets({ ...facets, tags })} />
        </IconPopover>
        <IconPopover icon={<Eye size={16} />} label="Status" active={statusActive}>
          <StatusToggles outdated={facets.outdatedOnly} needsEnrichment={facets.needsEnrichmentOnly}
            showHidden={showHidden} hiddenCount={hiddenCount}
            onChange={(p) => {
              if (p.outdated !== undefined) onFacets({ ...facets, outdatedOnly: p.outdated });
              if (p.needsEnrichment !== undefined) onFacets({ ...facets, needsEnrichmentOnly: p.needsEnrichment });
              if (p.showHidden !== undefined) onShowHidden(p.showHidden);
            }} />
          {(() => {
            const ne = items.filter(needsEnrichment).length;
            if (ne === 0) return null;
            return (
              <Popover.Close
                render={
                  <button className="pop-action" onClick={onDescribeAll} disabled={!describeEnabled || describingAll}
                    title={describeEnabled ? "Choose which un-enriched items to describe" : describeReason}>
                    <Sparkle size={14} />{describingAll ? "Describing…" : `Describe… (${ne})`}
                  </button>
                }
              />
            );
          })()}
        </IconPopover>
      </div>

      <div className="tb-actions">
      <div className="tb-group">
        <IconButton label={updatesDisabled ? "Needs Homebrew, npm, or mas" : "Check for updates"} onClick={onUpdates} disabled={updatesDisabled}>
          <ArrowsClockwise size={15} weight="bold" />
          {updatesCount > 0 && <span className="icon-badge num mono">{updatesCount}</span>}
        </IconButton>
        <IconButton label="Disk usage" onClick={onDisk}><HardDrive size={16} /></IconButton>
        <IconButton label={securityDisabled ? "Needs npm/cargo/uv/pipx + internet" : securityAlert ? "Vulnerabilities found — review" : "Security scan"}
          onClick={onSecurity} disabled={securityDisabled} className={securityAlert ? "alert" : ""}>
          <ShieldWarning size={16} weight={securityAlert ? "fill" : "regular"} />
        </IconButton>
        <IconButton label="Health check" onClick={onDoctor}><Heartbeat size={16} /></IconButton>
      </div>

      <div className="tb-group">
        <IconButton label="GitHub stars" onClick={onStars}><GithubLogo size={16} /></IconButton>
        <IconButton label="Export setup" onClick={onExport}><DownloadSimple size={16} /></IconButton>
      </div>

      <div className="tb-group">
        <IconButton label="Settings" onClick={onSettings}><Gear size={16} /></IconButton>
        <IconButton label="Toggle theme" onClick={onToggleTheme}>{isDark ? <Sun size={16} /> : <Moon size={16} />}</IconButton>
      </div>
      </div>
      </div>
    </div>
  );
}
