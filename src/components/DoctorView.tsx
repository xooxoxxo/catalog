import { useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, CaretRight, CaretDown, FolderOpen } from "@phosphor-icons/react";
import type { DoctorReport } from "../types";
import { CopyButton } from "./CopyButton";

function DoctorGroup({
  id, title, count, explain, open, onToggle, children,
}: {
  id: string; title: string; count: number; explain: string;
  open: boolean; onToggle: (id: string) => void; children: ReactNode;
}) {
  return (
    <div className="doctor-group">
      <button className="dg-head" onClick={() => onToggle(id)} aria-expanded={open}>
        <span className="caret">{open ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}</span>
        <span className="ttl">{title}</span>
        <span className="cnt mono">{count}</span>
      </button>
      {open && (
        <div className="dg-body">
          <p className="dg-explain">{explain}</p>
          {children}
        </div>
      )}
    </div>
  );
}

export function DoctorView() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({}); // all collapsed by default

  useEffect(() => {
    (async () => {
      try { setReport(await invoke<DoctorReport>("run_doctor")); }
      catch (e) { setError(String(e)); }
      finally { setBusy(false); }
    })();
  }, []);

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const reveal = (p: string) => invoke("reveal_in_finder", { path: p }).catch(() => {});

  const total = report ? report.shadowed.length + report.broken_symlinks.length + report.bad_path_dirs.length : 0;

  return (
    <>
      <p className="doctor-intro">
        Checks your shell <span className="mono">PATH</span> — the list of folders your terminal searches for commands.
        It flags three things that silently break or confuse which program actually runs.
      </p>

      {busy && (
        <div className="doctor-loading" aria-label="Scanning…">
          <span className="sk" /><span className="sk short" /><span className="sk" />
        </div>
      )}

      {error && <p className="status" style={{ color: "var(--danger)" }}>{error}</p>}

      {report && !busy && total === 0 && (
        <div className="doctor-clear">
          <CheckCircle weight="fill" size={34} className="ok" />
          <span className="big">All clear</span>
          <span>No PATH problems found.</span>
        </div>
      )}

      {report && !busy && total > 0 && (
        <>
          <p className="doctor-summary">{total} thing{total > 1 ? "s" : ""} worth a look. Expand a section for details.</p>

          {report.shadowed.length > 0 && (
            <DoctorGroup id="shadowed" title="Shadowed binaries" count={report.shadowed.length} open={!!open.shadowed} onToggle={toggle}
              explain="Two commands share a name. Only the first one on your PATH runs; the others are hidden — which can mean you're running a different version than you think.">
              {report.shadowed.map((s) => (
                <div key={s.name} className="doctor-finding">
                  <div><b>{s.name}</b> · winner: <span className="status">{s.winner}</span></div>
                  {s.shadowed_by.map((p) => (
                    <div key={p} className="doctor-sub">
                      <span className="status">shadowed: {p}</span>
                      <button className="link-chip" onClick={() => reveal(p)} title="Open the enclosing folder in Finder"><FolderOpen size={13} />Show in Finder</button>
                      <CopyButton text={p} title="Copy path" />
                    </div>
                  ))}
                </div>
              ))}
            </DoctorGroup>
          )}

          {report.broken_symlinks.length > 0 && (
            <DoctorGroup id="broken" title="Broken symlinks" count={report.broken_symlinks.length} open={!!open.broken} onToggle={toggle}
              explain="A shortcut on your PATH points at a file that no longer exists — usually left behind after an uninstall.">
              {report.broken_symlinks.map((b) => (
                <div key={b.path} className="doctor-finding">
                  <span className="status">{b.path} → {b.target} (missing)</span>
                  <div className="doctor-sub">
                    <button className="link-chip" onClick={() => reveal(b.path)} title="Open the enclosing folder in Finder"><FolderOpen size={13} />Show in Finder</button>
                    <CopyButton text={b.path} title="Copy path" />
                  </div>
                </div>
              ))}
            </DoctorGroup>
          )}

          {report.bad_path_dirs.length > 0 && (
            <DoctorGroup id="bad" title="Bad PATH entries" count={report.bad_path_dirs.length} open={!!open.bad} onToggle={toggle}
              explain="A PATH entry isn't a real directory, so nothing in it can ever be found. Harmless, but clutter worth cleaning.">
              {report.bad_path_dirs.map((d) => (
                <div key={d} className="doctor-finding">
                  <span className="status">{d} — not a directory</span>
                  <div className="doctor-sub">
                    <CopyButton text={d} title="Copy path" />
                  </div>
                </div>
              ))}
            </DoctorGroup>
          )}
        </>
      )}
    </>
  );
}
