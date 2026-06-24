import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Copy, Check } from "@phosphor-icons/react";

/** Icon-only copy control. Hidden until its row is hovered/focused (CSS), and
 *  flashes a check for ~1s after copying so the click has visible feedback. */
export function CopyButton({ text, title = "Copy" }: { text: string; title?: string }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1100);
    return () => clearTimeout(t);
  }, [done]);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    invoke("copy_text", { text }).catch(() => {});
    setDone(true);
    e.currentTarget.blur(); // don't let focus keep the hover-reveal button visible after the row loses hover
  };

  return (
    <button className={`copy-btn ${done ? "done" : ""}`} onClick={onClick} title={done ? "Copied" : title} aria-label={title}>
      {done ? <Check size={14} weight="bold" /> : <Copy size={14} />}
    </button>
  );
}
