import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { X, ArrowUpRight, BookOpen, FolderOpen, Copy, Star, Eye, EyeSlash, PencilSimple, Sparkle, CircleNotch, Warning } from "@phosphor-icons/react";
import type { EnrichedItem, Enrichment, Provider } from "../types";
import { itemLinks } from "../lib/links";
import { installCommand } from "../lib/install";
import { upgradeCommand } from "../lib/upgrade";
import { humanizeBytes } from "../lib/diskFormat";
import { uninstallCommand } from "../lib/uninstall";
import { describeButtonState } from "../lib/describeButton";
import { draftFromItem, isDirty, toEnrichment, type EnrichDraft } from "../lib/draft";
import { TagChipEditor } from "./TagChipEditor";
import { IconButton } from "./IconButton";

export function DetailSidebar({
  item, activeProvider, online, onClose, onSave, onDescribe, onStopDescribe, describing = false, update, disk = null, security = null, escEnabled = true,
}: {
  item: EnrichedItem;
  activeProvider?: Provider;
  online: boolean;
  onClose: () => void;
  onSave: (enr: Enrichment) => Promise<void>;
  onDescribe: (id: string) => void;
  onStopDescribe: (id: string) => void;
  describing?: boolean;
  update?: { current: string; latest: string } | null;
  disk?: import("../types").DiskInfo | null;
  security?: import("../types").SecurityFinding | null;
  escEnabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EnrichDraft>(draftFromItem(item));
  const [confirming, setConfirming] = useState(false);
  const [hasMan, setHasMan] = useState(false);
  const [man, setMan] = useState<string | null>(null);
  const [manErr, setManErr] = useState<string | null>(null);
  // Latches true once the first per-item async (has_man) settles, so the drawer
  // slides in only AFTER its content is final — no reflow "pop" mid-animation.
  const [appeared, setAppeared] = useState(false);

  // Reset form + UI when the displayed item changes (e.g. after a save re-selects it).
  useEffect(() => { setDraft(draftFromItem(item)); setEditing(false); setConfirming(false); setMan(null); }, [item]);
  useEffect(() => {
    let alive = true;
    invoke<boolean>("has_man", { name: item.name })
      .then((v) => { if (alive) setHasMan(v); })
      .catch(() => { if (alive) setHasMan(false); })
      .finally(() => { if (alive) setAppeared(true); });
    return () => { alive = false; };
  }, [item.name]);

  const cancelEdit = () => { setDraft(draftFromItem(item)); setEditing(false); setConfirming(false); };

  // Esc: cancel edit if editing, otherwise close the drawer. Suppressed while a
  // modal sheet is open above us, so Esc closes the topmost layer first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !escEnabled) return;
      if (editing) cancelEdit();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, item, onClose, escEnabled]);

  const dirty = editing && isDirty(draft, item);
  const btn = describeButtonState(activeProvider, online);
  const links = itemLinks(item);
  const install = installCommand(item);
  const upgrade = update ? upgradeCommand(item) : null;
  const set = (patch: Partial<EnrichDraft>) => setDraft({ ...draft, ...patch });

  const openLink = (url: string) => { invoke("open_url", { url }).catch(() => {}); };
  const reveal = () => { if (item.exec_path) invoke("reveal_in_finder", { path: item.exec_path }).catch(() => {}); };
  const openApp = () => { if (item.exec_path) invoke("open_url", { url: item.exec_path }).catch(() => {}); };
  const copy = (text: string) => { invoke("copy_text", { text }).catch(() => {}); };

  const showMan = async () => {
    setManErr(null);
    try { setMan(await invoke<string>("get_man", { name: item.name })); }
    catch (e) { setManErr(String(e)); }
  };

  const toggle = async (patch: { favorite?: boolean; hidden?: boolean }) => {
    // immediate persist of the current saved state with one flag flipped
    const base = toEnrichment(draftFromItem(item), item);
    await onSave({ ...base, favorite: patch.favorite ?? base.favorite, hidden: patch.hidden ?? base.hidden });
  };

  const saveEdit = async () => { await onSave(toEnrichment(draft, item)); setEditing(false); };
  const handleClose = () => { if (dirty) setConfirming(true); else onClose(); };
  const saveThenClose = async () => { await onSave(toEnrichment(draft, item)); onClose(); };

  return (
    <motion.aside className="sidebar"
      initial={{ x: "100%" }} animate={{ x: appeared ? 0 : "100%" }} exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      <div className="detail-head">
        <h1>{item.display_name}</h1>
        <button className="x" onClick={handleClose} title="Close (Esc)">
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="sc">
        <section className="detail">
          <div className="meta-row">
            {item.version && <span className="ver">{item.version}</span>}
            {update && <><span className="ver-sep">→</span><span className="ver up">{update.latest}</span></>}
            {disk?.size_bytes != null && <span className="ver">{humanizeBytes(disk.size_bytes)}</span>}
            {security && security.vulns.length > 0 && (
              <span className="ver vuln"><Warning size={12} weight="fill" style={{ display: "inline", marginRight: "3px" }} />{security.vulns.length} vuln{security.vulns.length > 1 ? "s" : ""}</span>
            )}
            {dirty && <span className="unsaved">● unsaved</span>}
          </div>

          <div className="detail-actions">
            <IconButton label={item.favorite ? "Remove favorite" : "Add to favorites"} className={item.favorite ? "on" : ""} onClick={() => toggle({ favorite: !item.favorite })}>
              <Star weight={item.favorite ? "fill" : "regular"} size={16} />
            </IconButton>
            <IconButton label={item.hidden ? "Unhide" : "Hide from lists"} className={item.hidden ? "on" : ""} onClick={() => toggle({ hidden: !item.hidden })}>
              {item.hidden ? <EyeSlash size={16} /> : <Eye size={16} />}
            </IconButton>
            {!editing && (describing
              ? <IconButton label="Stop describing" className="on" onClick={() => onStopDescribe(item.id)}><CircleNotch className="spin" size={16} /></IconButton>
              : <IconButton label={btn.enabled ? "Generate a description with AI" : btn.reason} disabled={!btn.enabled} onClick={() => onDescribe(item.id)}><Sparkle size={16} /></IconButton>
            )}
            {!editing && (
              <IconButton label="Edit" className="accent" onClick={() => setEditing(true)}><PencilSimple size={16} weight="bold" /></IconButton>
            )}
          </div>

          {confirming && (
            <div className="confirm-bar">
              <span>Unsaved changes.</span>
              <button className="primary" onClick={saveThenClose}>Save</button>
              <button className="ghost" onClick={onClose}>Discard</button>
              <button className="ghost" onClick={() => setConfirming(false)}>Stay</button>
            </div>
          )}

          {item.exec_path && <p className="path-line">{item.exec_path}</p>}

          {!editing ? (
            <>
              <div className="readonly">
                {item.description && <p className="detail-desc">{item.description}</p>}
                {item.tags.length > 0 && (
                  <div className="tag-chips" style={{ marginTop: "4px" }}>
                    {item.tags.map((t) => <span key={t} className="tag-chip static">{t}</span>)}
                  </div>
                )}
                {item.notes && <p className="status">notes: {item.notes}</p>}
                {!item.description && item.tags.length === 0 && !item.notes && (
                  <p className="status">No description yet — hit Edit to add one.</p>
                )}
              </div>

              <div className="detail-section">
                <span className="sec-label">Actions</span>
                <div className="chip-row">
                  {hasMan && <button className="link-chip" onClick={showMan} title="Show the manual page"><BookOpen size={14} />man page</button>}
                  {item.exec_path && item.exec_path.endsWith(".app") && <button className="link-chip" onClick={openApp} title="Launch this app">Open</button>}
                  {item.exec_path && <button className="link-chip" onClick={reveal} title="Open the enclosing folder in Finder"><FolderOpen size={14} />Show in Finder</button>}
                  {install && <button className="link-chip" onClick={() => copy(install)} title="Copy the install command"><Copy size={13} />install cmd</button>}
                  {item.exec_path && <button className="link-chip" onClick={() => copy(item.exec_path!)} title="Copy the file path"><Copy size={13} />path</button>}
                  {update && upgrade && <button className="link-chip" onClick={() => copy(upgrade)} title="Copy the upgrade command"><Copy size={13} />upgrade cmd</button>}
                  {disk?.removable && (() => {
                    const cmd = uninstallCommand(item);
                    return cmd
                      ? <button className="link-chip" onClick={() => copy(cmd)} title={disk.reason ?? "Uninstall"}><Copy size={13} />uninstall cmd</button>
                      : <span className="link-chip" title={disk.reason ?? ""} style={{ cursor: "default" }}>Move to Trash</span>;
                  })()}
                </div>
              </div>
              {manErr && <p className="status" style={{ color: "var(--danger)" }}>{manErr}</p>}
              {man && <pre className="manpage">{man}</pre>}

              {links.length > 0 && (
                <div className="detail-section">
                  <span className="sec-label">Links</span>
                  <div className="chip-row">
                    {links.map((l) => <button key={l.label} className="link-chip" onClick={() => openLink(l.url)}>{l.label}<ArrowUpRight size={12} weight="bold" /></button>)}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="edit">
              <label>Alias (overrides name)</label>
              <input value={draft.alias} onChange={(e) => set({ alias: e.target.value })} placeholder={item.name} autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} />
              <label>Description</label>
              <textarea rows={3} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder={item.raw_desc ?? ""} />
              <label>Tags</label>
              <TagChipEditor value={draft.tags} onChange={(tags) => set({ tags })} />
              <label>Notes</label>
              <textarea rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
              <div className="actions">
                <button className="primary" onClick={saveEdit} disabled={!isDirty(draft, item)}>Save</button>
                <button className="ghost" onClick={cancelEdit}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </motion.aside>
  );
}
