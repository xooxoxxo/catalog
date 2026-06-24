import type { Dep } from "../types";

export function presentNames(deps: Dep[]): Set<string> {
  return new Set(deps.filter((d) => d.present).map((d) => d.name));
}

/** Sorted names of the missing tools. */
export function missingNames(deps: Dep[]): string[] {
  return deps.filter((d) => !d.present).map((d) => d.name).sort();
}

/** Stable key for "have I already shown this exact missing-set?" */
export function missingKey(deps: Dep[]): string {
  return missingNames(deps).join(",");
}

/** Updates needs at least one of brew/npm/mas to do anything. */
export function updatesDisabled(present: Set<string>): boolean {
  return !(present.has("brew") || present.has("npm") || present.has("mas"));
}

/** Security needs internet AND at least one OSV-scannable manager. */
export function securityDisabled(present: Set<string>, online: boolean): boolean {
  return !online || !(present.has("npm") || present.has("cargo") || present.has("uv") || present.has("pipx"));
}
