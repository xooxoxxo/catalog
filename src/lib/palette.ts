export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** Case-insensitive substring match on label (and hint). Empty query → all. */
export function filterCommands(cmds: PaletteCommand[], q: string): PaletteCommand[] {
  const n = q.trim().toLowerCase();
  if (!n) return cmds;
  return cmds.filter((c) => c.label.toLowerCase().includes(n) || (c.hint?.toLowerCase().includes(n) ?? false));
}
