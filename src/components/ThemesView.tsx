import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { Plus, UploadSimple, DownloadSimple, PencilSimple, Trash, Copy, Sparkle, CircleNotch } from "@phosphor-icons/react";
import { BUILTINS, COLOR_TOKENS, TOKEN_LABELS, MAX_CUSTOM_THEMES, blankTheme, slugify, validateTheme, type Theme, type ColorToken } from "../lib/themes";
import { IconButton } from "./IconButton";

const FONT_UI: { label: string; value: string }[] = [
  { label: "Geist", value: "'Geist Variable', ui-sans-serif, system-ui, sans-serif" },
  { label: "System", value: "system-ui, -apple-system, sans-serif" },
  { label: "Serif", value: "ui-serif, Georgia, 'Times New Roman', serif" },
  { label: "Rounded", value: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" },
];
const FONT_MONO: { label: string; value: string }[] = [
  { label: "Geist Mono", value: "'Geist Mono Variable', ui-monospace, monospace" },
  { label: "SF Mono", value: "ui-monospace, 'SF Mono', Menlo, monospace" },
  { label: "Menlo", value: "Menlo, monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
];
const isHex = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());

function FontSelect({ value, options, onChange }: { value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }) {
  const known = options.some((o) => o.value === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && <option value={value}>Custom</option>}
      {options.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function ThemesView({ themes, activeId, defaults, onSelect, onSave, onDelete, onApplyPreview, onRestore, describeEnabled, describeReason }: {
  themes: Theme[];
  activeId: string;
  defaults: { light: string; dark: string };
  onSelect: (id: string) => void;
  onSave: (t: Theme) => void;
  onDelete: (id: string) => void;
  onApplyPreview: (t: Theme) => void;
  onRestore: () => void;
  describeEnabled: boolean;
  describeReason: string;
}) {
  const [editing, setEditing] = useState<Theme | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [vibe, setVibe] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);

  const generate = async () => {
    setGenErr(null);
    setGenBusy(true);
    try {
      const base = editing?.base ?? "dark";
      const pal = await invoke<Record<string, string>>("llm_theme", { vibe, base });
      setEditing((e) => {
        if (!e) return e;
        const colors = { ...e.colors };
        for (const tok of COLOR_TOKENS) { const v = pal[tok]; if (typeof v === "string" && isHex(v)) colors[tok] = v.trim(); }
        const next = { ...e, colors };
        onApplyPreview(next);
        return next;
      });
    } catch (e) { setGenErr(`Generate failed: ${String(e)}`); }
    finally { setGenBusy(false); }
  };
  const isBuiltin = (id: string) => BUILTINS.some((b) => b.id === id);
  const full = themes.length >= MAX_CUSTOM_THEMES;

  const startEdit = (t: Theme) => { setErr(null); setEditing(structuredClone(t)); };
  const newTheme = () => { setErr(null); setEditing({ ...blankTheme("dark"), id: `theme-${Date.now().toString(36)}` }); };
  const duplicate = (t: Theme) => {
    const name = `${t.name} copy`;
    setErr(null);
    setEditing({ ...structuredClone(t), id: `${slugify(name)}-${Date.now().toString(36)}`, name });
  };
  const setTok = (tok: ColorToken, val: string) =>
    setEditing((e) => { if (!e) return e; const next = { ...e, colors: { ...e.colors, [tok]: val } }; onApplyPreview(next); return next; });
  const setFont = (k: "ui" | "mono", val: string) =>
    setEditing((e) => { if (!e) return e; const next = { ...e, fonts: { ...e.fonts, [k]: val } }; onApplyPreview(next); return next; });
  const setRadius = (n: number) =>
    setEditing((e) => { if (!e) return e; const next = { ...e, radius: n }; onApplyPreview(next); return next; });
  const cancel = () => { setEditing(null); onRestore(); };
  const commit = () => { if (editing && editing.name.trim()) { onSave({ ...editing, id: editing.id || slugify(editing.name) }); setEditing(null); } };

  const doImport = async () => {
    setErr(null);
    try {
      const path = await openDialog({ filters: [{ name: "catalog theme", extensions: ["ctlgtheme"] }], multiple: false });
      if (typeof path !== "string") return;
      const raw = await invoke<string>("read_theme_file", { path });
      const res = validateTheme(JSON.parse(raw));
      if (res.ok) onSave(res.theme); else setErr(`Import failed: ${res.error}`);
    } catch (e) { setErr(`Import failed: ${String(e)}`); }
  };
  const doExport = async (t: Theme) => {
    try {
      const path = await saveDialog({ defaultPath: `${t.id}.ctlgtheme` });
      if (typeof path === "string") await invoke("export_theme", { path, theme: t });
    } catch { /* cancelled */ }
  };

  if (editing) {
    return (
      <div className="theme-editor">
        <label>Name</label>
        <input value={editing.name} onChange={(e) => setEditing((x) => x ? { ...x, name: e.target.value } : x)} autoCorrect="off" spellCheck={false} />
        <label>Mode</label>
        <div className="seg">
          {(["light", "dark"] as const).map((b) => (
            <button key={b} type="button" className={editing.base === b ? "on" : ""}
              onClick={() => setEditing((e) => { if (!e) return e; const next = { ...e, base: b }; onApplyPreview(next); return next; })}>
              {b === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
        <label>Generate from a vibe</label>
        <div className="theme-gen">
          <input value={vibe} onChange={(e) => setVibe(e.target.value)} placeholder="e.g. warm terminal green, faded blueprint…"
            disabled={genBusy} autoCorrect="off" spellCheck={false} />
          <button className="primary" onClick={generate} disabled={genBusy || !describeEnabled || !vibe.trim()}
            title={describeEnabled ? "Generate a palette with AI" : describeReason}>
            {genBusy ? <CircleNotch className="spin" size={14} /> : <Sparkle size={14} />}{genBusy ? "Generating…" : "Generate"}
          </button>
        </div>
        {genErr && <p className="status" style={{ color: "var(--danger)" }}>{genErr}</p>}
        <div className="tok-list">
          {COLOR_TOKENS.map((tok) => (
            <div key={tok} className="tok-row">
              <span className="tok-label">{TOKEN_LABELS[tok]}</span>
              <input type="color" className="tok-color" value={isHex(editing.colors[tok]) ? editing.colors[tok] : "#000000"} onChange={(e) => setTok(tok, e.target.value)} />
              <input className="tok-hex mono" value={editing.colors[tok]} onChange={(e) => setTok(tok, e.target.value)} autoCorrect="off" spellCheck={false} />
            </div>
          ))}
        </div>
        <label>UI font</label>
        <FontSelect value={editing.fonts.ui} options={FONT_UI} onChange={(v) => setFont("ui", v)} />
        <label>Mono font</label>
        <FontSelect value={editing.fonts.mono} options={FONT_MONO} onChange={(v) => setFont("mono", v)} />
        <label>Roundness <span className="mono" style={{ color: "var(--text-3)" }}>{editing.radius}px</span></label>
        <input type="range" min={0} max={20} step={1} value={editing.radius} onChange={(e) => setRadius(Number(e.target.value))} />
        <div className="actions">
          <button className="primary" onClick={commit} disabled={!editing.name.trim()}>Save theme</button>
          <button className="ghost" onClick={cancel}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dsel-bar">
        <button className="link-chip" onClick={newTheme} disabled={full} title={full ? "Theme limit reached" : "Create a blank theme"}><Plus size={13} />New</button>
        <button className="link-chip" onClick={doImport} disabled={full} title={full ? "Theme limit reached" : "Import a .ctlgtheme file"}><UploadSimple size={13} />Import</button>
        <span className="dsel-count">{themes.length} / {MAX_CUSTOM_THEMES} custom</span>
      </div>
      {err && <p className="status" style={{ color: "var(--danger)" }}>{err}</p>}
      {full
        ? <p className="theme-hint theme-hint-warn">Theme limit reached ({MAX_CUSTOM_THEMES} custom themes). Delete one to add or import a new theme.</p>
        : <p className="theme-hint">Picking a theme makes it the default for its mode — the light/dark toggle swaps between your two defaults.</p>}
      <div className="theme-list">
        <p className="theme-group-label">Built-in</p>
        {BUILTINS.map(row)}
        <p className="theme-group-label">Your themes</p>
        {themes.length ? themes.map(row) : <p className="theme-empty">No custom themes yet — pick New or Import to make one.</p>}
      </div>
    </>
  );

  function row(t: Theme) {
    return (
      <div key={t.id} className={`theme-row ${t.id === activeId ? "active" : ""}`}>
        <button className="theme-pick" onClick={() => onSelect(t.id)}>
          <span className="swatch">
            {(["bg", "surface", "accent", "text"] as ColorToken[]).map((k) => <span key={k} style={{ background: t.colors[k] }} />)}
          </span>
          <span className="theme-name">{t.name}</span>
          {defaults[t.base] === t.id && <span className="theme-default">{t.base} default</span>}
          <span className="theme-base mono">{t.base}</span>
        </button>
        <div className="theme-actions">
          <IconButton label={full ? "Theme limit reached" : "Duplicate"} disabled={full} onClick={() => duplicate(t)}><Copy size={15} /></IconButton>
          {!isBuiltin(t.id) && (
            <>
              <IconButton label="Edit" onClick={() => startEdit(t)}><PencilSimple size={15} /></IconButton>
              <IconButton label="Export" onClick={() => doExport(t)}><DownloadSimple size={15} /></IconButton>
              <IconButton label="Delete" onClick={() => onDelete(t.id)}><Trash size={15} /></IconButton>
            </>
          )}
        </div>
      </div>
    );
  }
}
