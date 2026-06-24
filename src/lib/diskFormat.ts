import { clamp } from "./math";

/** Human-readable byte size. null/undefined -> "—". */
export function humanizeBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

/** Percentage width of a size bar relative to the largest item (min 2 for visibility). */
export function barPct(size: number, max: number): number {
  if (!max || max <= 0) return 0;
  return clamp(Math.round((size / max) * 100), 2, 100);
}
