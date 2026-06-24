/** Determinate progress bar with a centered "done / total" label that stays
 *  readable on both sides of the fill: the base label sits on the track, and a
 *  second copy (in the fill's foreground colour) is clip-pathed to the filled
 *  width, so the number "inverts" exactly where the fill crosses it. */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;
  const label = `${done} / ${total}`;
  return (
    <div className="pbar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
      <div className="pbar-fill" style={{ width: `${pct}%` }} />
      <span className="pbar-label mono">{label}</span>
      <span className="pbar-label pbar-label-over mono" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>{label}</span>
    </div>
  );
}
