import { useMemo } from "react";
import { HardDrive } from "@phosphor-icons/react";
import type { EnrichedItem, DiskInfo, DiskProgress } from "../types";
import { humanizeBytes, barPct } from "../lib/diskFormat";
import { uninstallCommand } from "../lib/uninstall";
import { CopyButton } from "./CopyButton";

const TOP_N = 15;

export function DiskView({
  items, disk, analyzing, progress, onAnalyze,
}: {
  items: EnrichedItem[];
  disk: Record<string, DiskInfo>;
  analyzing: boolean;
  progress: DiskProgress | null;
  onAnalyze: () => void;
}) {
  const byId = useMemo(() => {
    const m: Record<string, EnrichedItem> = {};
    for (const it of items) m[it.id] = it;
    return m;
  }, [items]);

  const infos = Object.values(disk);
  const analyzed = infos.length > 0;
  const sized = infos.filter((d) => d.size_bytes != null) as (DiskInfo & { size_bytes: number })[];
  const total = sized.reduce((s, d) => s + d.size_bytes, 0);
  const max = sized.reduce((m, d) => Math.max(m, d.size_bytes), 0);
  const largest = [...sized].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, TOP_N);
  const removable = infos
    .filter((d) => d.removable)
    .sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0));
  const removableTotal = removable.reduce((s, d) => s + (d.size_bytes ?? 0), 0);
  const name = (id: string) => byId[id]?.display_name ?? id;

  return (
    <>
      <div className="upd-progress">
        <button className="tbtn accent" onClick={onAnalyze} disabled={analyzing}>
          <HardDrive size={15} weight="bold" />
          {analyzing ? "Analyzing…" : analyzed ? "Re-analyze" : "Analyze disk usage"}
        </button>
        {analyzing && progress && (
          <span className="upd-src">{progress.done}/{progress.total}</span>
        )}
        {analyzed && !analyzing && (
          <span className="upd-src done">total {humanizeBytes(total)}</span>
        )}
      </div>

      {!analyzed && !analyzing && (
        <div className="empty">
          <div className="big">See what's eating your disk.</div>
          <span>Analyze to size every tool and surface what's safe to remove.</span>
        </div>
      )}

      {removable.length > 0 && (
        <div className="disk-section">
          <div className="sec-label">Safe to remove · {humanizeBytes(removableTotal)}</div>
          {removable.map((d) => {
            const it = byId[d.id];
            const cmd = it ? uninstallCommand(it) : null;
            return (
              <div key={d.id} className="upd-row">
                <span className="upd-name">{name(d.id)}</span>
                <span className="disk-reason">{d.reason}</span>
                <span className="upd-ver mono">{humanizeBytes(d.size_bytes)}</span>
                {cmd ? <CopyButton text={cmd} title="Copy uninstall command" /> : <span className="disk-hint">Move to Trash</span>}
              </div>
            );
          })}
        </div>
      )}

      {largest.length > 0 && (
        <div className="disk-section">
          <div className="sec-label">Largest</div>
          {largest.map((d) => (
            <div key={d.id} className="disk-row">
              <span className="upd-name">{name(d.id)}</span>
              <span className="disk-bar"><span className="disk-bar-fill" style={{ width: `${barPct(d.size_bytes, max)}%` }} /></span>
              <span className="upd-ver mono">{humanizeBytes(d.size_bytes)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
