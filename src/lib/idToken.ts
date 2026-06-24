/** The bare token of a namespaced id: `brew:eza` -> `eza`, `eza` -> `eza`. */
export function idToken(id: string): string {
  const i = id.indexOf(":");
  return i >= 0 ? id.slice(i + 1) : id;
}
