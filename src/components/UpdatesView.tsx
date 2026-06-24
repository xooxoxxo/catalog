import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, ArrowRight, Copy, Check, Play, ArrowsClockwise } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";
import { upgradeCommand } from "../lib/upgrade";
import { buildUpdateScript } from "../lib/updateScript";
import { CopyButton } from "./CopyButton";
import { IconButton } from "./IconButton";

const SOURCES = ["brew", "cask", "npm", "mas"] as const;

export function UpdatesView({
  outdated, updates, progress, online, checking, onRecheck, onClose: _onClose,
}: {
  outdated: EnrichedItem[];
  updates: Record<string, { current: string; latest: string }>;
  progress: Record<string, { status: string; count: number }>;
  online: boolean;
  checking: boolean;
  onRecheck: () => void;
  onClose: () => void;
}) {
  const ran = useRef(false);
  useEffect(() => {
    if (!ran.current && online) { ran.current = true; onRecheck(); }
  }, [online, onRecheck]);

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1100);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = (text: string) => invoke("copy_text", { text }).catch(() => {});
  const script = buildUpdateScript(outdated);
  const bySource = (s: string) => outdated.filter((i) => i.source === s);

  return (
    <>
      {!online && <p className="status" style={{ color: "var(--danger)" }}>Needs internet to check for updates.</p>}

      <div className="upd-progress">
        {["brew", "npm", "mas"].map((s) => {
          const p = progress[s];
          const scanning = !p || p.status === "checking";
          return (
            <span key={s} className={`upd-src ${scanning ? "" : "done"}`}>
              {s}{scanning ? " …" : <><CheckCircle weight="fill" size={12} /> {p.count}</>}
            </span>
          );
        })}
        <div className="upd-actions">
          <IconButton label="Re-check" onClick={onRecheck} disabled={!online || checking}>
            <ArrowsClockwise size={15} weight="bold" className={checking ? "spin" : ""} />
          </IconButton>
          {script && (
            <>
              <IconButton label={copied ? "Copied" : "Copy update script"} onClick={() => { copy(script); setCopied(true); }}>
                {copied ? <Check size={15} weight="bold" /> : <Copy size={15} />}
              </IconButton>
              <IconButton label="Run in Terminal" onClick={() => invoke("run_in_terminal", { script }).catch(() => {})}>
                <Play size={15} weight="fill" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {!checking && outdated.length === 0 && (
        <div className="doctor-clear">
          <CheckCircle weight="fill" size={34} className="ok" />
          <span className="big">Up to date</span>
          <span>Everything is on its latest version.</span>
        </div>
      )}

      {SOURCES.map((s) => {
        const group = bySource(s);
        if (group.length === 0) return null;
        return (
          <div key={s} className="upd-group">
            <div className="upd-head">{s}<span className="cnt mono">{group.length}</span></div>
            {group.map((it) => {
              const u = updates[it.id];
              const cmd = upgradeCommand(it);
              return (
                <div key={it.id} className="upd-row">
                  {cmd && <CopyButton text={cmd} title="Copy upgrade command" />}
                  <span className="upd-name">{it.display_name}</span>
                  <span className="upd-ver mono">{u?.current} <ArrowRight size={11} weight="bold" /> {u?.latest}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
