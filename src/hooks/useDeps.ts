import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { missingKey } from "../lib/deps";
import type { Dep } from "../types";

/**
 * External-dependency check. Auto-opens the dependency sheet on launch when
 * something required is missing (unless the user dismissed that exact set).
 */
export function useDeps() {
  const [deps, setDeps] = useState<Dep[]>([]);
  const [showDeps, setShowDeps] = useState(false);
  const [depsChecked, setDepsChecked] = useState(false);
  const [depsOnlyMissing, setDepsOnlyMissing] = useState(false);

  useEffect(() => {
    invoke<Dep[]>("check_deps")
      .then((d) => {
        setDeps(d);
        const key = missingKey(d);
        if (key && key !== localStorage.getItem("catalog-deps-dismissed")) {
          setDepsOnlyMissing(false);
          setShowDeps(true);
        }
      })
      .catch(() => {})
      .finally(() => setDepsChecked(true));
  }, []);

  const dismissDeps = () => {
    setShowDeps(false);
    localStorage.setItem("catalog-deps-dismissed", missingKey(deps));
  };

  return { deps, showDeps, setShowDeps, depsChecked, depsOnlyMissing, setDepsOnlyMissing, dismissDeps };
}
