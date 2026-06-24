export type ColorToken =
  | "bg" | "surface" | "surface2" | "line" | "line2"
  | "text" | "text-2" | "text-3"
  | "accent" | "accent-fg" | "update" | "orphan" | "danger";

export const COLOR_TOKENS: ColorToken[] = [
  "bg", "surface", "surface2", "line", "line2",
  "text", "text-2", "text-3",
  "accent", "accent-fg", "update", "orphan", "danger",
];

/** Human labels for the editor (display order = COLOR_TOKENS). */
export const TOKEN_LABELS: Record<ColorToken, string> = {
  bg: "Background", surface: "Surface", surface2: "Surface 2", line: "Line", line2: "Line 2",
  text: "Text", "text-2": "Text 2", "text-3": "Text 3",
  accent: "Accent", "accent-fg": "Accent text", update: "Update", orphan: "Orphan", danger: "Danger",
};

export interface Theme {
  id: string;
  name: string;
  base: "light" | "dark";
  colors: Record<ColorToken, string>;
  fonts: { ui: string; mono: string };
  radius: number; // corner roundness in px (sm/lg derive from it)
}

export const DEFAULT_RADIUS = 10;
/** Cap on user-created/imported themes (builtins don't count). */
export const MAX_CUSTOM_THEMES = 20;

const GEIST = "'Geist Variable', ui-sans-serif, system-ui, -apple-system, sans-serif";
const GEIST_MONO = "'Geist Mono Variable', ui-monospace, SFMono-Regular, monospace";

/** A neutral, un-themed starting point for "New" — distinct from any builtin. */
export function blankTheme(base: "light" | "dark"): Theme {
  const colors: Record<ColorToken, string> = base === "light"
    ? { bg: "#ffffff", surface: "#ffffff", surface2: "#f4f4f4", line: "#e8e8e8", line2: "#dddddd",
        text: "#1b1b1f", "text-2": "#55555c", "text-3": "#9a9aa0",
        accent: "#7a7a82", "accent-fg": "#ffffff", update: "#1c7d4d", orphan: "#b8772a", danger: "#c2415a" }
    : { bg: "#141416", surface: "#19191c", surface2: "#1e1e22", line: "rgba(255,255,255,.06)", line2: "rgba(255,255,255,.09)",
        text: "#f4f4f6", "text-2": "#b0b0b8", "text-3": "#73737d",
        accent: "#8a8a92", "accent-fg": "#141416", update: "#7fae5a", orphan: "#d39b4a", danger: "#f38ba8" };
  return { id: "new", name: "New theme", base, radius: DEFAULT_RADIUS, fonts: { ui: GEIST, mono: GEIST_MONO }, colors };
}

export const BUILTINS: Theme[] = [
  { id: "paper", name: "Paper", base: "light", radius: DEFAULT_RADIUS, fonts: { ui: GEIST, mono: GEIST_MONO },
    colors: { bg: "#fafaf8", surface: "#ffffff", surface2: "#f3f3f0", line: "#ececea", line2: "#e3e3df",
      text: "#1b1b1f", "text-2": "#55555c", "text-3": "#a0a09a",
      accent: "#b23a64", "accent-fg": "#ffffff", update: "#1c7d4d", orphan: "#b8772a", danger: "#c2415a" } },
  { id: "noir", name: "Noir", base: "dark", radius: DEFAULT_RADIUS, fonts: { ui: GEIST, mono: GEIST_MONO },
    colors: { bg: "#101012", surface: "#16161a", surface2: "#1a1a1e", line: "rgba(255,255,255,.06)", line2: "rgba(255,255,255,.09)",
      text: "#f4f4f6", "text-2": "#b0b0b8", "text-3": "#73737d",
      accent: "#c4f042", "accent-fg": "#101012", update: "#cdef6e", orphan: "#d39b4a", danger: "#f38ba8" } },
];

/** Pure: theme -> CSS-var map (testable without the DOM). */
export function themeToVars(t: Theme): Record<string, string> {
  const v: Record<string, string> = {};
  for (const tok of COLOR_TOKENS) v["--" + tok] = t.colors[tok];
  v["--ui"] = t.fonts.ui;
  v["--mono"] = t.fonts.mono;
  v["--radius"] = `${t.radius}px`;
  return v;
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  const vars = themeToVars(t);
  for (const k in vars) root.style.setProperty(k, vars[k]);
  root.dataset.theme = t.base;
  try { localStorage.setItem("catalog-active-theme", JSON.stringify({ base: t.base, vars })); } catch { /* ignore */ }
}

export function resolveTheme(id: string, customs: Theme[]): Theme | undefined {
  return [...BUILTINS, ...customs].find((t) => t.id === id);
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function validColor(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const v = s.trim();
  return HEX.test(v) || v.startsWith("rgb") || v.startsWith("hsl");
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
}

/** Pure: validate an imported object into a Theme, or return an error string. */
export function validateTheme(raw: unknown): { ok: true; theme: Theme } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "not an object" };
  const o = raw as Record<string, unknown>;
  if (o.base !== "light" && o.base !== "dark") return { ok: false, error: "base must be light or dark" };
  const c = o.colors;
  if (!c || typeof c !== "object") return { ok: false, error: "missing colors" };
  const colors = {} as Record<ColorToken, string>;
  for (const tok of COLOR_TOKENS) {
    const val = (c as Record<string, unknown>)[tok];
    if (!validColor(val)) return { ok: false, error: `invalid color: ${tok}` };
    colors[tok] = (val as string).trim();
  }
  const f = o.fonts as { ui?: unknown; mono?: unknown } | undefined;
  const ui = typeof f?.ui === "string" && f.ui.trim() ? (f.ui as string) : GEIST;
  const mono = typeof f?.mono === "string" && f.mono.trim() ? (f.mono as string) : GEIST_MONO;
  const name = typeof o.name === "string" && o.name.trim() ? (o.name as string).trim() : "Imported theme";
  const id = typeof o.id === "string" && o.id.trim() ? slugify(o.id as string) : slugify(name);
  const radius = typeof o.radius === "number" && o.radius >= 0 ? Math.min(24, o.radius) : DEFAULT_RADIUS;
  return { ok: true, theme: { id, name, base: o.base, colors, fonts: { ui, mono }, radius } };
}
