/** Copy-able uninstall command for an item, or null when there's no safe CLI
 *  (apps/mas/go → user moves to Trash / removes the binary manually). */
export function uninstallCommand(item: { source: string; name: string; id: string }): string | null {
  const token = item.id.includes(":") ? item.id.slice(item.id.indexOf(":") + 1) : item.id;
  switch (item.source) {
    case "brew": return `brew uninstall ${item.name}`;
    case "cask": return `brew uninstall --cask ${token}`;
    case "npm": return `npm -g uninstall ${item.name}`;
    case "cargo": return `cargo uninstall ${item.name}`;
    case "uv": return `uv tool uninstall ${item.name}`;
    case "pipx": return `pipx uninstall ${item.name}`;
    default: return null; // app, mas, go, orphan, bun
  }
}
