import { useState } from "react";
import { ArrowsClockwise, PencilSimple } from "@phosphor-icons/react";
import type { Config, Provider, GithubStatus } from "../types";
import { GithubSettings } from "./GithubSettings";
import { EditableField } from "./EditableField";
import { About } from "./About";

export function SettingsView({
  config, online: _online, onClose: _onClose, onSaveProvider, onRescan, scanning, itemCount, onOpenDeps, githubClientId, onSaveGithubClientId, ghStatus, onGhChanged, onOpenThemes, nvdApiKey, onSaveNvdKey,
}: {
  config: Config;
  online: boolean;
  onClose: () => void;
  onSaveProvider: (active: string, providers: Record<string, Provider>) => Promise<void>;
  onRescan: () => void;
  scanning: boolean;
  itemCount: number;
  onOpenDeps: () => void;
  githubClientId: string;
  onSaveGithubClientId: (id: string) => void;
  ghStatus: GithubStatus | null;
  onGhChanged: () => void;
  onOpenThemes: () => void;
  nvdApiKey: string;
  onSaveNvdKey: (key: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(config.active);
  const [providers, setProviders] = useState<Record<string, Provider>>(config.providers);

  const p = providers[active];
  const setP = (patch: Partial<Provider>) =>
    setProviders({ ...providers, [active]: { ...p, ...patch } });

  const saveProvider = async () => { await onSaveProvider(active, providers); setEditing(false); };
  const cancelProvider = () => { setActive(config.active); setProviders(config.providers); setEditing(false); };
  const cur = config.providers[config.active];

  return (
    <>
      <div className="lib-row">
        <div>
          <div className="lib-title">Library</div>
          <div className="lib-sub">{itemCount} items indexed · rescan to pick up newly installed software (apps, npm, cargo, go, pipx, App Store…).</div>
        </div>
        <button className="tbtn" onClick={onRescan} disabled={scanning}>
          <ArrowsClockwise size={15} weight="bold" className={scanning ? "spin" : ""} /> {scanning ? "Scanning…" : "Rescan"}
        </button>
      </div>
      <div className="lib-row" style={{ marginTop: "10px" }}>
        <div>
          <div className="lib-title">Dependencies</div>
          <div className="lib-sub">Which CLI tools catalog found (brew, npm, mas, …) and what they power.</div>
        </div>
        <button className="tbtn" onClick={onOpenDeps} style={{ marginLeft: "auto", flex: "0 0 auto" }}>View</button>
      </div>
      <div className="lib-row" style={{ marginTop: "10px" }}>
        <div>
          <div className="lib-title">Appearance</div>
          <div className="lib-sub">Switch, edit, import, or export color + font themes.</div>
        </div>
        <button className="tbtn" onClick={onOpenThemes} style={{ marginLeft: "auto", flex: "0 0 auto" }}>Themes</button>
      </div>
      <div className="sec-divider" />

      {!editing ? (
        <div className="field filled">
          <div className="field-head">
            <div className="field-val-wrap">
              <span className="field-label">AI provider for descriptions</span>
              <span className="field-value mono">{config.active} · {cur?.command} {cur?.args.join(" ")}</span>
            </div>
            <button className="field-edit" onClick={() => setEditing(true)} title="Edit AI provider"><PencilSimple size={13} weight="bold" /> Edit</button>
          </div>
        </div>
      ) : (
        <div className="field editing">
          <span className="field-label">AI provider for descriptions</span>
          <select value={active} onChange={(e) => setActive(e.target.value)}>
            {Object.keys(providers).sort().map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <label>Command</label>
          <input value={p.command} onChange={(e) => setP({ command: e.target.value })} placeholder="e.g. ollama"
            autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} />
          <label>Arguments</label>
          <textarea rows={3} value={p.args.join("\n")} onChange={(e) => setP({ args: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            spellCheck={false} />
          <p className="hint">One per line. Use <span className="mono">{"{prompt}"}</span> where the prompt goes (omit when piping to stdin).</p>
          <div className="row">
            <label style={{ margin: 0 }}><input type="checkbox" checked={p.stdin} onChange={(e) => setP({ stdin: e.target.checked })} /> Pipe prompt to stdin</label>
            <label style={{ margin: 0 }}><input type="checkbox" checked={p.requires_online} onChange={(e) => setP({ requires_online: e.target.checked })} /> Requires internet</label>
          </div>
          <div className="field-actions">
            <button className="primary" onClick={saveProvider}>Save</button>
            <button className="ghost" onClick={cancelProvider}>Cancel</button>
          </div>
        </div>
      )}

      <div className="sec-divider" />
      <label>GitHub</label>
      <GithubSettings clientId={githubClientId} onSaveClientId={onSaveGithubClientId} status={ghStatus} onChanged={onGhChanged} />

      <div className="sec-divider" />
      <label>Security (experimental)</label>
      <EditableField label="NVD API key" value={nvdApiKey} placeholder="xxxxxxxx-xxxx-…" ctaText="Set NVD key" mask
        hint="Free key from nvd.nist.gov — enables the experimental Homebrew CVE scan." onSave={onSaveNvdKey} />

      <div className="sec-divider" />
      <About />
    </>
  );
}
