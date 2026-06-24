import type { ReactNode } from "react";
import { Tip } from "./Tip";

/** Shared icon button: the home-toolbar `tbtn icon` look + a tooltip on hover.
 *  Children are the icon(s)/badge so callers can compose (e.g. icon + count badge). */
export function IconButton({ label, onClick, disabled, className = "", children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tip label={label}>
      <button className={`tbtn icon ${className}`} onClick={onClick} disabled={disabled}>{children}</button>
    </Tip>
  );
}
