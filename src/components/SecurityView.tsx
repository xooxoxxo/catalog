import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ShieldWarning, ShieldCheck, ArrowUpRight } from "@phosphor-icons/react";
import type { SecurityFinding, SecurityProgress, NvdProgress } from "../types";
import { ProgressBar } from "./ProgressBar";

const ORDER = ["MALWARE", "CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"];

export function SecurityView({
  findings, scanning, scanned, progress, online, onScan,
  nvdKeySet, hbCves, hbScanning, hbProgress, onScanHomebrew,
}: {
  findings: SecurityFinding[];
  scanning: boolean;
  scanned: boolean;
  progress: SecurityProgress | null;
  online: boolean;
  onScan: () => void;
  nvdKeySet: boolean;
  hbCves: SecurityFinding[];
  hbScanning: boolean;
  hbProgress: NvdProgress | null;
  onScanHomebrew: () => void;
}) {
  const ran = useRef(false);
  useEffect(() => {
    if (!ran.current && online && !scanned) { ran.current = true; onScan(); }
  }, [online, scanned, onScan]);

  const open = (url: string) => invoke("open_url", { url }).catch(() => {});
  const sortRows = (list: SecurityFinding[]) =>
    list.flatMap((f) => f.vulns.map((v) => ({ f, v })))
      .sort((a, b) => ORDER.indexOf(a.v.severity) - ORDER.indexOf(b.v.severity));

  const findingRows = (list: SecurityFinding[], linkLabel: string) => (
    <div className="sec-list">
      {sortRows(list).map(({ f, v }) => (
        <div key={f.item_id + v.id} className="sec-row">
          <span className={`sev sev-${v.severity.toLowerCase()}`}>{v.severity}</span>
          <div className="sec-main">
            <div className="sec-pkg"><b>{f.package}</b> <span className="mono">{f.version}</span> · {v.aliases[0] ?? v.id}</div>
            {v.summary && <div className="sec-sum">{v.summary}</div>}
            {v.fixed && <div className="sec-fixed">fixed in {v.fixed}</div>}
          </div>
          <button className="link-chip" onClick={() => open(v.url)}>{linkLabel}<ArrowUpRight size={12} weight="bold" /></button>
        </div>
      ))}
    </div>
  );

  const osvRows = sortRows(findings);

  return (
    <>
      {!online && <p className="status" style={{ color: "var(--danger)" }}>Needs internet to scan.</p>}

      <div className="sec-head">
        <p className="doctor-intro">
          Checks npm, cargo, and PyPI (pipx/uv) packages against the OSV database for known
          vulnerabilities and malicious packages. Homebrew, Go, apps, and App Store items aren&apos;t covered by OSV.
        </p>
        <button className="tbtn accent" onClick={onScan} disabled={scanning || !online}>
          <ShieldWarning size={15} weight="bold" />
          {scanning ? "Scanning…" : scanned ? "Re-scan" : "Scan"}
        </button>
      </div>
      {scanning && progress && <div className="sec-progress"><ProgressBar done={progress.done} total={progress.total} /></div>}

      {scanned && !scanning && osvRows.length === 0 && (
        <div className="doctor-clear">
          <ShieldCheck weight="fill" size={34} className="ok" />
          <span className="big">No known vulnerabilities</span>
          <span>Across the scanned package managers.</span>
        </div>
      )}

      {osvRows.length > 0 && findingRows(findings, "OSV")}

      <div className="sec-divider" />
      <div className="hb-cve">
        <div className="lib-row">
          <div>
            <div className="lib-title">Homebrew CVEs <span className="exp-tag">experimental</span></div>
            <div className="lib-sub">Version-matched against NVD. May miss tools whose names differ from NVD&apos;s, and can&apos;t always show a fixed version.</div>
          </div>
          <button className="tbtn" onClick={onScanHomebrew} disabled={!nvdKeySet || hbScanning}
            title={nvdKeySet ? "" : "Add an NVD API key in Settings"} style={{ marginLeft: "auto", flex: "0 0 auto" }}>
            {hbScanning ? "Scanning…" : "Scan"}
          </button>
        </div>
        {hbScanning && hbProgress && <div className="sec-progress"><ProgressBar done={hbProgress.done} total={hbProgress.total} /></div>}
        {!nvdKeySet && <p className="status">Add an NVD API key in Settings to enable this.</p>}
        {hbCves.length > 0 && findingRows(hbCves, "NVD")}
      </div>
    </>
  );
}
