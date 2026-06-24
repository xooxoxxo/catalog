import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { applyTheme, resolveTheme, validateTheme, BUILTINS, MAX_CUSTOM_THEMES, type Theme } from "../lib/themes";
import type { Config } from "../types";

/**
 * Theme state: custom themes, the active theme, and per-mode defaults. Picking
 * any theme records it as that mode's default (its `base` picks the slot); the
 * sun/moon toggle swaps between the two. Also drains/listens for .ctlgtheme
 * files the OS hands us (double-clicked in Finder).
 */
export function useThemes() {
  const [themes, setThemes] = useState<Theme[]>([]); // custom themes
  const [activeTheme, setActiveThemeId] = useState<string>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "noir" : "paper",
  );
  // Per-mode default theme. Picking any theme records it as that mode's default
  // (its `base` picks the slot); the sun/moon toggle swaps between the two.
  const [modeDefaults, setModeDefaults] = useState<{ light: string; dark: string }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem("catalog-mode-defaults") || "null");
      if (s && typeof s.light === "string" && typeof s.dark === "string") return s;
    } catch {
      /* ignore */
    }
    return { light: "paper", dark: "noir" };
  });
  const [showThemes, setShowThemes] = useState(false);

  const selectTheme = useCallback(
    (id: string, customs?: Theme[]) => {
      const t = resolveTheme(id, customs ?? themes);
      if (!t) return;
      applyTheme(t);
      setActiveThemeId(id);
      setModeDefaults((d) => {
        const next = { ...d, [t.base]: id };
        try {
          localStorage.setItem("catalog-mode-defaults", JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      invoke("set_active_theme", { id }).catch(() => {});
    },
    [themes],
  );

  const isDark = (resolveTheme(activeTheme, themes)?.base ?? "dark") === "dark";

  // sun/moon: swap to the other mode's chosen default (builtin fallback if it was deleted).
  const toggleTheme = useCallback(() => {
    const target = isDark ? modeDefaults.light : modeDefaults.dark;
    selectTheme(resolveTheme(target, themes) ? target : isDark ? "paper" : "noir");
  }, [isDark, modeDefaults, themes, selectTheme]);

  const saveTheme = useCallback(
    async (t: Theme) => {
      const isNew = !themes.some((x) => x.id === t.id);
      if (isNew && themes.length >= MAX_CUSTOM_THEMES) {
        toast.error(`Theme limit reached (${MAX_CUSTOM_THEMES}). Delete some to add or import new ones.`);
        return;
      }
      await invoke("save_theme", { theme: t });
      const custom = await invoke<Theme[]>("list_themes");
      setThemes(custom);
      selectTheme(t.id, custom);
    },
    [selectTheme, themes],
  );

  const deleteTheme = useCallback(
    async (id: string) => {
      await invoke("delete_theme", { id });
      const custom = await invoke<Theme[]>("list_themes");
      setThemes(custom);
      if (activeTheme === id) selectTheme("noir", custom);
    },
    [activeTheme, selectTheme],
  );

  const restoreActive = useCallback(() => {
    const t = resolveTheme(activeTheme, themes);
    if (t) applyTheme(t);
  }, [activeTheme, themes]);

  // Open a .ctlgtheme the OS handed us (double-clicked file) → import + show Themes.
  const importThemeFromPath = useCallback(
    async (path: string) => {
      try {
        const raw = await invoke<string>("read_theme_file", { path });
        const res = validateTheme(JSON.parse(raw));
        if (res.ok) {
          await saveTheme(res.theme);
          setShowThemes(true);
        }
      } catch {
        /* ignore unreadable/invalid file */
      }
    },
    [saveTheme],
  );

  // .ctlgtheme files opened from Finder: drain any queued at launch + listen for live opens.
  useEffect(() => {
    invoke<string[]>("take_pending_theme_files")
      .then((paths) => paths.forEach(importThemeFromPath))
      .catch(() => {});
    const un = listen<string[]>("open-theme-files", (e) => e.payload.forEach(importThemeFromPath));
    return () => {
      un.then((f) => f());
    };
  }, [importThemeFromPath]);

  // Load custom themes + apply the saved active theme on launch.
  useEffect(() => {
    invoke<Theme[]>("list_themes")
      .then((custom) => {
        setThemes(custom);
        invoke<Config>("get_config")
          .then((cfg) => {
            const t = resolveTheme(cfg.active_theme, custom) ?? resolveTheme(activeTheme, custom) ?? BUILTINS[1];
            applyTheme(t);
            setActiveThemeId(t.id);
          })
          .catch(() => {});
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    themes,
    activeTheme,
    modeDefaults,
    selectTheme,
    isDark,
    toggleTheme,
    saveTheme,
    deleteTheme,
    restoreActive,
    importThemeFromPath,
    showThemes,
    setShowThemes,
  };
}
