import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { GithubLogo, ArrowSquareOut } from "@phosphor-icons/react";
import type { DeviceCode, GithubStatus } from "../types";
import { EditableField } from "./EditableField";

export function GithubSettings({ clientId, onSaveClientId, status, onChanged }: {
  clientId: string;
  onSaveClientId: (id: string) => void;
  status: GithubStatus | null;       // cached at App level — not re-fetched here
  onChanged: () => void;             // tell App to re-check after connect/disconnect
}) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const open = (url: string) => invoke("open_url", { url }).catch(() => {});
  const copy = (t: string) => invoke("copy_text", { text: t }).catch(() => {});

  const connect = async () => {
    setError(null);
    try {
      const dc = await invoke<DeviceCode>("gh_device_start", { clientId });
      setCode(dc); setWaiting(true);
      open(dc.verification_uri); copy(dc.user_code);
      const deadline = Date.now() + 15 * 60 * 1000;
      const poll = async (ms: number) => {
        if (Date.now() > deadline) { setError("Code expired — try again."); setWaiting(false); setCode(null); return; }
        let st = "error";
        try { st = await invoke<string>("gh_device_poll", { clientId, deviceCode: dc.device_code }); } catch { /* transient */ }
        if (st === "connected") { setWaiting(false); setCode(null); onChanged(); return; }
        if (st === "denied") { setError("Authorization denied."); setWaiting(false); setCode(null); return; }
        if (st === "expired") { setError("Code expired — try again."); setWaiting(false); setCode(null); return; }
        const next = st === "slow_down" ? ms + 5000 : ms;
        timer.current = window.setTimeout(() => poll(next), next);
      };
      timer.current = window.setTimeout(() => poll(dc.interval * 1000), dc.interval * 1000);
    } catch (e) { setError(String(e)); setWaiting(false); }
  };

  const disconnect = async () => { await invoke("gh_disconnect").catch(() => {}); onChanged(); };

  return (
    <div className="gh">
      {status?.connected ? (
        <div className="gh-connected">
          {status.avatar_url && <img className="gh-avatar" src={status.avatar_url} alt="" />}
          <span>Connected as <b>@{status.login}</b></span>
          <button className="ghost" style={{ marginLeft: "auto" }} onClick={disconnect}>Disconnect</button>
        </div>
      ) : waiting && code ? (
        <div className="gh-wait">
          <span className="status">Enter this code at GitHub:</span>
          <div className="gh-code mono" onClick={() => copy(code.user_code)} title="Copy">{code.user_code}</div>
          <button className="link-chip" onClick={() => open(code.verification_uri)}>Open github.com/login/device<ArrowSquareOut size={12} weight="bold" /></button>
          <span className="status">Waiting for authorization…</span>
        </div>
      ) : (
        <div className="gh-connect">
          <button className="primary" onClick={connect}><GithubLogo size={15} weight="fill" style={{ display: "inline", marginRight: "6px" }} />Connect GitHub</button>
        </div>
      )}

      {error && <p className="status" style={{ color: "var(--danger)" }}>{error}</p>}

      {!status?.connected && (
        <details className="gh-advanced">
          <summary>Advanced — use your own OAuth app</summary>
          <EditableField
            label="Client ID"
            value={clientId}
            placeholder="Ov23…"
            ctaText="Set Client ID"
            hint={'Optional. Leave blank to use the built-in catalog app. To use your own, register a GitHub OAuth App with "Enable Device Flow" on and paste its Client ID.'}
            onSave={onSaveClientId}
          />
        </details>
      )}
    </div>
  );
}
