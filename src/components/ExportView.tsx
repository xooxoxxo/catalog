import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CaretRight, CaretDown, DownloadSimple } from "@phosphor-icons/react";
import type { EnrichedItem, ExportFile } from "../types";
import { buildBrewfile, buildRestoreScript, buildReport, buildSbom } from "../lib/exportFormats";
import { CopyButton } from "./CopyButton";

const INSTALLABLE = ["brew", "cask", "mas", "npm", "cargo", "uv", "pipx"];

export function ExportView({ items }: { items: EnrichedItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(items.filter((i) => INSTALLABLE.includes(i.source) && !i.hidden).map((i) => i.id)),
  );
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [gen, setGen] = useState<null | { Brewfile: string; "restore.sh": string; "catalog-report.md": string; "sbom.cdx.json": string }>(null);
  const [savedDir, setSavedDir] = useState<string | null>(null);

  const m: Record<string, EnrichedItem[]> = {};
  for (const it of items) (m[it.source] ??= []).push(it);
  const groups = Object.entries(m).sort(([a], [b]) => a.localeCompare(b));

  const setSel = (next: Set<string>) => { setSelected(next); setGen(null); setSavedDir(null); };
  const toggle = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const toggleGroup = (src: string, on: boolean) => {
    const n = new Set(selected);
    for (const it of items) if (it.source === src) { on ? n.add(it.id) : n.delete(it.id); }
    setSel(n);
  };
  const shortcut = (pred: (i: EnrichedItem) => boolean) => setSel(new Set(items.filter(pred).map((i) => i.id)));

  const generate = () => {
    const sel = items.filter((i) => selected.has(i.id));
    const date = new Date().toISOString().slice(0, 10);
    setGen({
      Brewfile: buildBrewfile(sel, date),
      "restore.sh": buildRestoreScript(sel, date),
      "catalog-report.md": buildReport(sel, date, items.length),
      "sbom.cdx.json": buildSbom(sel, new Date().toISOString()),
    });
  };

  const save = async () => {
    if (!gen) return;
    const files: ExportFile[] = [
      { name: "Brewfile", content: gen.Brewfile, executable: false },
      { name: "restore.sh", content: gen["restore.sh"], executable: true },
      { name: "catalog-report.md", content: gen["catalog-report.md"], executable: false },
      { name: "sbom.cdx.json", content: gen["sbom.cdx.json"], executable: false },
    ];
    try {
      const dir = await invoke<string>("save_export", { files });
      setSavedDir(dir);
      invoke("reveal_in_finder", { path: dir }).catch(() => {});
    } catch { /* ignore */ }
  };

  return (
    <>
      <div className="exp-bar">
        <button className="tg" onClick={() => shortcut(() => true)}>All</button>
        <button className="tg" onClick={() => setSel(new Set())}>None</button>
        <button className="tg" onClick={() => shortcut((i) => i.favorite)}>Favorites</button>
        <button className="tg" onClick={() => shortcut((i) => INSTALLABLE.includes(i.source) && !i.hidden)}>Installable</button>
        <span className="exp-count mono">{selected.size} of {items.length}</span>
        <button className="tbtn accent" onClick={generate} disabled={selected.size === 0} style={{ marginLeft: "auto" }}>
          <DownloadSimple size={15} weight="bold" /> Generate
        </button>
      </div>

      {groups.map(([src, list]) => {
        const sel = list.filter((i) => selected.has(i.id)).length;
        const isOpen = !!open[src];
        return (
          <div key={src} className="exp-group">
            <div className="exp-head">
              <button className="exp-toggle" onClick={() => setOpen((o) => ({ ...o, [src]: !o[src] }))}>
                {isOpen ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
                <span className="ttl">{src}</span>
                <span className="cnt mono">{sel}/{list.length}</span>
              </button>
              <input type="checkbox" checked={list.length > 0 && sel === list.length}
                ref={(el) => { if (el) el.indeterminate = sel > 0 && sel < list.length; }}
                onChange={(e) => toggleGroup(src, e.target.checked)} />
            </div>
            {isOpen && (
              <div className="exp-items">
                {list.map((it) => (
                  <label key={it.id} className="exp-item">
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                    <span className="exp-name">{it.display_name}</span>
                    {it.version && <span className="exp-ver mono">{it.version}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {gen && (
        <div className="exp-results">
          {(["Brewfile", "restore.sh", "catalog-report.md", "sbom.cdx.json"] as const).map((name) => (
            <div key={name} className="exp-artifact">
              <div className="exp-art-head"><span className="mono">{name}</span><CopyButton text={gen[name]} title={`Copy ${name}`} /></div>
              <pre className="exp-pre">{gen[name]}</pre>
            </div>
          ))}
          <div className="exp-save">
            <button className="tbtn accent" onClick={save}>Save to ~/Downloads/catalog-export</button>
            {savedDir && <span className="status">Saved to {savedDir}</span>}
          </div>
        </div>
      )}
    </>
  );
}
