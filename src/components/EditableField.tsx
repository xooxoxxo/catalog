import { useState, type KeyboardEvent } from "react";
import { PencilSimple, Check, X } from "@phosphor-icons/react";

/** A settings field with three states — empty (CTA), filled (value + Edit), editing
 *  (input + inline Save/Cancel). No always-on input; one clearly-scoped Save. Reusable
 *  for any single-value setting. `mask` shows a dotted summary instead of the raw value. */
export function EditableField({
  label, value, placeholder, hint, ctaText = "Set", mask = false, onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  ctaText?: string;
  mask?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const start = () => { setDraft(value); setEditing(true); };
  const commit = () => { onSave(draft.trim()); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); if (draft.trim()) commit(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); } // don't close the sheet
  };

  const shown = mask && value ? "•".repeat(Math.min(value.length, 16)) : value;

  if (editing) {
    return (
      <div className="field editing">
        <span className="field-label">{label}</span>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={placeholder}
          autoFocus autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false} />
        {hint && <p className="hint">{hint}</p>}
        <div className="field-actions">
          <button className="primary" onClick={commit} disabled={!draft.trim()}><Check size={14} weight="bold" /> Save</button>
          <button className="ghost" onClick={cancel}><X size={14} weight="bold" /> Cancel</button>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="field empty">
        <div className="field-head">
          <span className="field-label">{label}</span>
          <button className="field-cta" onClick={start}>{ctaText}</button>
        </div>
        {hint && <p className="hint">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="field filled">
      <div className="field-head">
        <div className="field-val-wrap">
          <span className="field-label">{label}</span>
          <span className="field-value mono">{shown}</span>
        </div>
        <button className="field-edit" onClick={start} title={`Edit ${label}`}><PencilSimple size={13} weight="bold" /> Edit</button>
      </div>
    </div>
  );
}
