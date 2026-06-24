/** Constrain `val` to the inclusive `[min, max]` range. */
export const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));
