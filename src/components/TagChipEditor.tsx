import { useState, type KeyboardEvent } from "react";
import { X } from "@phosphor-icons/react";

/** Edit a comma-separated tag string as removable chips + a free-text adder.
 *  Keeps the value as a comma string so draft.isDirty / toEnrichment are unchanged. */
export function TagChipEditor({
  value,
  onChange,
  placeholder = "add tag…",
}: {
  value: string;
  onChange: (commaString: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const tags = value.split(",").map((t) => t.trim()).filter(Boolean);

  const commit = (next: string[]) => onChange(next.join(", "));

  const add = () => {
    const t = text.trim().replace(/,+$/, "").trim();
    if (t && !tags.includes(t)) commit([...tags, t]);
    setText("");
  };
  const remove = (t: string) => commit(tags.filter((x) => x !== t));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    else if (e.key === "Backspace" && !text && tags.length) remove(tags[tags.length - 1]);
  };

  return (
    <div className="tag-field">
      <div className="tag-chips">
        {tags.map((t) => (
          <span key={t} className="tag-chip">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => remove(t)}>
              <X size={11} weight="bold" />
            </button>
          </span>
        ))}
      </div>
      <input
        className="tag-add"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={tags.length ? "" : placeholder}
        autoCorrect="off" autoCapitalize="off" autoComplete="off" spellCheck={false}
      />
    </div>
  );
}
