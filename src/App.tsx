import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { Toaster, toast } from "sonner";
import { notify } from "./lib/notify";
import type { EnrichedItem, Enrichment, Config, Provider, Update, UpdateProgress, DiskInfo, DiskProgress, SecurityFinding, SecurityProgress, NvdProgress, Dep, Repo, GithubStatus, Suggestion } from "./types";
import { DependencyView } from "./components/DependencyView";
import { presentNames, missingKey, updatesDisabled as updatesDisabledFn, securityDisabled as securityDisabledFn } from "./lib/deps";
import { filterItems } from "./lib/filter";
import { partitionItems } from "./lib/partition";
import { applyFacets, type Facets } from "./lib/facets";
import { describeButtonState } from "./lib/describeButton";
import { applyTheme, resolveTheme, validateTheme, BUILTINS, MAX_CUSTOM_THEMES, type Theme } from "./lib/themes";
import { VirtualItemList } from "./components/VirtualItemList";
import { FavoritesGroup } from "./components/FavoritesGroup";
import { groupRows, type GroupBy } from "./lib/grouping";
import { DetailSidebar } from "./components/DetailSidebar";
import { Sheet } from "./components/Sheet";
import { SettingsView } from "./components/SettingsView";
import { ThemesView } from "./components/ThemesView";
import { CommandPalette } from "./components/CommandPalette";
import type { PaletteCommand } from "./lib/palette";
import { DoctorView } from "./components/DoctorView";
import { UpdatesView } from "./components/UpdatesView";
import { DiskView } from "./components/DiskView";
import { DescribeView } from "./components/DescribeView";
import { SecurityView } from "./components/SecurityView";
import { ExportView } from "./components/ExportView";
import { Toolbar } from "./components/Toolbar";
import { SkeletonRows } from "./components/SkeletonRows";
import { StarsView } from "./components/StarsView";
import { ReadmeView } from "./components/ReadmeView";
import "./styles.css";

function enrichmentOf(it: EnrichedItem): Enrichment {
  return { alias: it.display_name === it.name ? "" : it.display_name, description: it.description ?? "",
    tags: it.tags, favorite: it.favorite, hidden: it.hidden, notes: it.notes, llm_confirmed: it.llm_confirmed };
}

export default function App() {
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [q, setQ] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => setCollapsedGroups((c) => {
    const n = new Set(c);
    n.has(key) ? n.delete(key) : n.add(key);
    return n;
  });
  const [selected, setSelected] = useState<EnrichedItem | null>(null);
  const [status, setStatus] = useState("loading…");
  const [facets, setFacets] = useState<Facets>({ sources: [], tags: [], needsEnrichmentOnly: false, outdatedOnly: false });
  const [config, setConfig] = useState<Config | null>(null);
  const [online, setOnline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDoctor, setShowDoctor] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showDisk, setShowDisk] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [updates, setUpdates] = useState<Record<string, { current: string; latest: string }>>({});
  const [disk, setDisk] = useState<Record<string, DiskInfo>>({});
  const [analyzingDisk, setAnalyzingDisk] = useState(false);
  const [diskProgress, setDiskProgress] = useState<DiskProgress | null>(null);
  const [showSecurity, setShowSecurity] = useState(false);
  const [security, setSecurity] = useState<Record<string, SecurityFinding>>({});
  const [scanningSecurity, setScanningSecurity] = useState(false);
  const [securityScanned, setSecurityScanned] = useState(false);
  const [securityProgress, setSecurityProgress] = useState<SecurityProgress | null>(null);
  const [hbCves, setHbCves] = useState<SecurityFinding[]>([]);
  const [hbScanning, setHbScanning] = useState(false);
  const [hbProgress, setHbProgress] = useState<NvdProgress | null>(null);
  const [showStars, setShowStars] = useState(false);
  const [showDescribe, setShowDescribe] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [readmeRepo, setReadmeRepo] = useState<Repo | null>(null);
  // Stars live at App level so they survive closing the sheet — fetched once on first
  // open, then only on manual Refresh (no reload on every reopen).
  const [stars, setStars] = useState<Repo[]>([]);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [starsLoaded, setStarsLoaded] = useState(false);
  const [starsLoading, setStarsLoading] = useState(false);
  // GitHub connection status, fetched once and cached — re-checked only on an auth error.
  const [ghStatus, setGhStatus] = useState<GithubStatus | null>(null);
  const [ghStatusLoaded, setGhStatusLoaded] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [progress, setProgress] = useState<Record<string, { status: string; count: number }>>({});
  const [deps, setDeps] = useState<Dep[]>([]);
  const [showDeps, setShowDeps] = useState(false);
  const [depsChecked, setDepsChecked] = useState(false);
  const [depsOnlyMissing, setDepsOnlyMissing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [themes, setThemes] = useState<Theme[]>([]);          // custom themes
  const [activeTheme, setActiveThemeId] = useState<string>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "noir" : "paper");
  // Per-mode default theme. Picking any theme records it as that mode's default
  // (its `base` picks the slot); the sun/moon toggle swaps between the two.
  const [modeDefaults, setModeDefaults] = useState<{ light: string; dark: string }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem("catalog-mode-defaults") || "null");
      if (s && typeof s.light === "string" && typeof s.dark === "string") return s;
    } catch { /* ignore */ }
    return { light: "paper", dark: "noir" };
  });

  const selectTheme = useCallback((id: string, customs?: Theme[]) => {
    const t = resolveTheme(id, customs ?? themes);
    if (!t) return;
    applyTheme(t);
    setActiveThemeId(id);
    setModeDefaults((d) => {
      const next = { ...d, [t.base]: id };
      try { localStorage.setItem("catalog-mode-defaults", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    invoke("set_active_theme", { id }).catch(() => {});
  }, [themes]);

  const isDark = (resolveTheme(activeTheme, themes)?.base ?? "dark") === "dark";
  // sun/moon: swap to the other mode's chosen default (builtin fallback if it was deleted).
  const toggleTheme = useCallback(() => {
    const target = isDark ? modeDefaults.light : modeDefaults.dark;
    selectTheme(resolveTheme(target, themes) ? target : (isDark ? "paper" : "noir"));
  }, [isDark, modeDefaults, themes, selectTheme]);

  const [showThemes, setShowThemes] = useState(false);
  const saveTheme = useCallback(async (t: Theme) => {
    const isNew = !themes.some((x) => x.id === t.id);
    if (isNew && themes.length >= MAX_CUSTOM_THEMES) {
      toast.error(`Theme limit reached (${MAX_CUSTOM_THEMES}). Delete some to add or import new ones.`);
      return;
    }
    await invoke("save_theme", { theme: t });
    const custom = await invoke<Theme[]>("list_themes");
    setThemes(custom);
    selectTheme(t.id, custom);
  }, [selectTheme, themes]);
  const deleteTheme = useCallback(async (id: string) => {
    await invoke("delete_theme", { id });
    const custom = await invoke<Theme[]>("list_themes");
    setThemes(custom);
    if (activeTheme === id) selectTheme("noir", custom);
  }, [activeTheme, selectTheme]);
  const restoreActive = useCallback(() => {
    const t = resolveTheme(activeTheme, themes);
    if (t) applyTheme(t);
  }, [activeTheme, themes]);

  // Open a .ctlgtheme the OS handed us (double-clicked file) → import + show Themes.
  const importThemeFromPath = useCallback(async (path: string) => {
    try {
      const raw = await invoke<string>("read_theme_file", { path });
      const res = validateTheme(JSON.parse(raw));
      if (res.ok) { await saveTheme(res.theme); setShowThemes(true); }
    } catch { /* ignore unreadable/invalid file */ }
  }, [saveTheme]);

  const refresh = useCallback(async () => {
    let rows = await invoke<EnrichedItem[]>("query");
    if (rows.length === 0) { await invoke<number>("scan"); rows = await invoke<EnrichedItem[]>("query"); }
    setItems(rows);
    setStatus(`${rows.length} items`);
    setLoading(false);
  }, []);

  const checkUpdates = async () => {
    setCheckingUpdates(true);
    setProgress({});
    try {
      const list = await invoke<Update[]>("check_updates");
      const map: Record<string, { current: string; latest: string }> = {};
      for (const u of list) map[u.id] = { current: u.current, latest: u.latest };
      setUpdates(map);
      notify("Update check complete", list.length ? `${list.length} update${list.length > 1 ? "s" : ""} available` : "Everything is up to date");
    } catch { /* leave prior map */ }
    finally { setCheckingUpdates(false); }
  };

  const analyzeDisk = async () => {
    setAnalyzingDisk(true);
    setDiskProgress(null);
    try {
      const list = await invoke<DiskInfo[]>("analyze_disk");
      const map: Record<string, DiskInfo> = {};
      for (const d of list) map[d.id] = d;
      setDisk(map);
      notify("Disk analysis complete", `${list.length} item${list.length > 1 ? "s" : ""} measured`);
    } catch { /* keep prior map */ }
    finally { setAnalyzingDisk(false); }
  };

  const scanSecurity = async () => {
    setScanningSecurity(true);
    setSecurityProgress(null);
    try {
      const list = await invoke<SecurityFinding[]>("scan_security");
      const map: Record<string, SecurityFinding> = {};
      for (const f of list) map[f.item_id] = f;
      setSecurity(map);
      notify("Security scan complete", list.length ? `${list.length} package${list.length > 1 ? "s" : ""} with findings` : "No known vulnerabilities");
    } catch { /* keep prior map */ }
    finally { setScanningSecurity(false); setSecurityScanned(true); }
  };

  const scanHomebrewCves = async () => {
    setHbScanning(true);
    setHbProgress(null);
    try {
      const list = await invoke<SecurityFinding[]>("scan_homebrew_cves");
      setHbCves(list);
      notify("Homebrew CVE scan complete", list.length ? `${list.length} formula${list.length > 1 ? "e" : ""} with CVEs` : "No CVEs matched");
    } catch (e) { setStatus(`Homebrew CVE scan: ${String(e)}`); toast.error(`Homebrew CVE scan failed`); }
    finally { setHbScanning(false); }
  };

  const loadGhStatus = useCallback(async () => {
    try { setGhStatus(await invoke<GithubStatus>("gh_status")); }
    catch { setGhStatus({ connected: false, login: null, avatar_url: null }); }
    finally { setGhStatusLoaded(true); }
  }, []);

  const loadStars = useCallback(async () => {
    setStarsLoading(true);
    try {
      const r = await invoke<Repo[]>("gh_list_stars");
      setStars(r);
      setStarred(new Set(r.map((x) => x.full_name)));
    } catch { setStars([]); }
    finally { setStarsLoading(false); setStarsLoaded(true); }
  }, []);

  const toggleStar = useCallback(async (r: Repo) => {
    const on = starred.has(r.full_name);
    setStarred((prev) => { const n = new Set(prev); on ? n.delete(r.full_name) : n.add(r.full_name); return n; });
    try { await invoke(on ? "gh_unstar" : "gh_star", { owner: r.owner, repo: r.name }); }
    catch { // revert + re-verify the connection (token may have been revoked)
      setStarred((prev) => { const n = new Set(prev); on ? n.add(r.full_name) : n.delete(r.full_name); return n; });
      loadGhStatus();
    }
  }, [starred, loadGhStatus]);

  const rescan = useCallback(async () => {
    setScanning(true);
    try {
      await invoke("scan");
      const rows = await invoke<EnrichedItem[]>("query");
      setItems(rows);
      setStatus(`${rows.length} items`);
    } catch (e) { setStatus(`error: ${String(e)}`); }
    finally { setScanning(false); }
  }, []);

  useEffect(() => { refresh().catch((e) => setStatus(`error: ${String(e)}`)); }, [refresh]);

  // .ctlgtheme files opened from Finder: drain any queued at launch + listen for live opens.
  useEffect(() => {
    invoke<string[]>("take_pending_theme_files").then((paths) => paths.forEach(importThemeFromPath)).catch(() => {});
    const un = listen<string[]>("open-theme-files", (e) => e.payload.forEach(importThemeFromPath));
    return () => { un.then((f) => f()); };
  }, [importThemeFromPath]);

  // Load custom themes + apply the saved active theme on launch.
  useEffect(() => {
    invoke<Theme[]>("list_themes").then((custom) => {
      setThemes(custom);
      invoke<Config>("get_config").then((cfg) => {
        const t = resolveTheme(cfg.active_theme, custom) ?? resolveTheme(activeTheme, custom) ?? BUILTINS[1];
        applyTheme(t);
        setActiveThemeId(t.id);
      }).catch(() => {});
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    invoke<Config>("get_config").then(setConfig).catch(() => {});
    invoke<boolean>("check_online").then(setOnline).catch(() => {});
  }, []);

  useEffect(() => {
    invoke<Dep[]>("check_deps").then((d) => {
      setDeps(d);
      const key = missingKey(d);
      if (key && key !== localStorage.getItem("catalog-deps-dismissed")) { setDepsOnlyMissing(false); setShowDeps(true); }
    }).catch(() => {}).finally(() => setDepsChecked(true));
  }, []);

  // Focus the search field once deps are checked and no splash is up (avoids a cursor blink behind the modal).
  useEffect(() => { if (depsChecked && !showDeps) searchRef.current?.focus(); }, [depsChecked, showDeps]);

  // live per-source progress
  useEffect(() => {
    const un = listen<UpdateProgress>("updates-progress", (e) => {
      setProgress((p) => ({ ...p, [e.payload.source]: { status: e.payload.status, count: e.payload.count } }));
    });
    return () => { un.then((f) => f()); };
  }, []);

  useEffect(() => {
    const un = listen<DiskProgress>("disk-progress", (e) => setDiskProgress(e.payload));
    return () => { un.then((f) => f()); };
  }, []);

  useEffect(() => {
    const un = listen<SecurityProgress>("security-progress", (e) => setSecurityProgress(e.payload));
    return () => { un.then((f) => f()); };
  }, []);

  useEffect(() => {
    const un = listen<NvdProgress>("nvd-progress", (e) => setHbProgress(e.payload));
    return () => { un.then((f) => f()); };
  }, []);

  const dismissDeps = () => {
    setShowDeps(false);
    localStorage.setItem("catalog-deps-dismissed", missingKey(deps));
  };

  const save = useCallback(async (id: string, enr: Enrichment) => {
    await invoke("save_enrichment", { id, enrichment: enr });
    await refresh();
  }, [refresh]);

  const activeProvider = config ? config.providers[config.active] : undefined;
  const describeBtn = describeButtonState(activeProvider, online);

  // Scoped provider save — persists without closing the sheet (mirrors GitHub field).
  const saveProvider = async (active: string, providers: Record<string, Provider>) => {
    if (!config) return;
    const cfg = { ...config, active, providers };
    await invoke("save_config", { config: cfg });
    setConfig(cfg);
  };

  const saveGithubClientId = async (id: string) => {
    if (!config) return;
    const cfg = { ...config, github_client_id: id };
    await invoke("save_config", { config: cfg });
    setConfig(cfg);
  };

  const saveNvdKey = async (key: string) => {
    if (!config) return;
    const cfg = { ...config, nvd_api_key: key };
    await invoke("save_config", { config: cfg });
    setConfig(cfg);
  };

  const toggleFavorite = useCallback((it: EnrichedItem) => {
    save(it.id, { ...enrichmentOf(it), favorite: !it.favorite });
  }, [save]);

  // Background describe: fire-and-continue, auto-applies the suggestion to that item
  // even if the user navigates away. Off the main thread (llm_describe is async).
  const [describing, setDescribing] = useState<Set<string>>(new Set());
  // ids the user stopped mid-describe: the in-flight provider call still finishes,
  // but we ignore its result. (We can't force-kill the spawned CLI from here.)
  const cancelledItems = useRef<Set<string>>(new Set());
  const describeItem = useCallback(async (id: string) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    cancelledItems.current.delete(id);
    setDescribing((s) => new Set(s).add(id));
    try {
      const sug = await invoke<Suggestion>("llm_describe", { id });
      if (cancelledItems.current.has(id)) { cancelledItems.current.delete(id); return; }
      await invoke("save_enrichment", { id, enrichment: { ...enrichmentOf(it), description: sug.description, tags: sug.tags } });
      const rows = await invoke<EnrichedItem[]>("query");
      setItems(rows);
      setSelected((prev) => (prev?.id === id ? rows.find((r) => r.id === id) ?? prev : prev));
    } catch (e) { setStatus(`describe failed: ${String(e)}`); }
    finally { setDescribing((s) => { const n = new Set(s); n.delete(id); return n; }); }
  }, [items]);
  const stopItem = useCallback((id: string) => {
    cancelledItems.current.add(id);
    setDescribing((s) => { const n = new Set(s); n.delete(id); return n; });
  }, []);

  // Batch describe: ~12 items per provider call (one prompt → many results), run
  // sequentially. Far fewer calls than one-per-item. Progress shown in the sheet.
  const [describingAll, setDescribingAll] = useState(false);
  const [describeProgress, setDescribeProgress] = useState<{ done: number; total: number } | null>(null);
  const describeCancel = useRef(false);
  const stopDescribeAll = useCallback(() => { describeCancel.current = true; }, []);
  const describeMany = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const BATCH = 12;
    describeCancel.current = false;
    setDescribingAll(true);
    setDescribeProgress({ done: 0, total: ids.length });
    let done = 0;
    let stopped = false;
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        if (describeCancel.current) { stopped = true; break; }
        const chunk = ids.slice(i, i + BATCH);
        setDescribing((s) => { const n = new Set(s); chunk.forEach((id) => n.add(id)); return n; });
        try {
          const map = await invoke<Record<string, Suggestion>>("llm_describe_batch", { ids: chunk });
          for (const id of chunk) {
            const sug = map[id];
            const it = items.find((x) => x.id === id);
            if (sug && it) await invoke("save_enrichment", { id, enrichment: { ...enrichmentOf(it), description: sug.description, tags: sug.tags } });
          }
        } catch { /* batch failed — leave its items un-enriched, continue */ }
        finally { setDescribing((s) => { const n = new Set(s); chunk.forEach((id) => n.delete(id)); return n; }); }
        done += chunk.length;
        setDescribeProgress({ done, total: ids.length });
      }
      const rows = await invoke<EnrichedItem[]>("query");
      setItems(rows);
      notify(stopped ? "Describe stopped" : "Describe complete", `${done} item${done === 1 ? "" : "s"} processed`);
    } finally { setDescribingAll(false); setDescribeProgress(null); setShowDescribe(false); }
  }, [items]);

  const outdatedIds = new Set(Object.keys(updates));
  const securityAlert = Object.values(security).some((f) => f.vulns.length > 0);
  const present = presentNames(deps);
  const updatesGated = updatesDisabledFn(present);
  const securityGated = securityDisabledFn(present, online);
  const faceted = applyFacets(items, facets, outdatedIds);
  const filtered = filterItems(faceted, q);
  const { favorites, others, hiddenCount } = partitionItems(filtered, showHidden);

  const onDetailSave = async (enr: Enrichment) => {
    if (!selected) return;
    await invoke("save_enrichment", { id: selected.id, enrichment: enr });
    const rows = await invoke<EnrichedItem[]>("query");
    setItems(rows);
    setStatus(`${rows.length} items`);
    setSelected(rows.find((r) => r.id === selected.id) ?? null);
  };

  // ⌘K / Ctrl+K toggles the command palette — ignored while another sheet is open.
  useEffect(() => {
    const anySheet = showSettings || showUpdates || showDisk || showSecurity || showStars || showExport || showDoctor || showDeps || showThemes || showDescribe || !!readmeRepo;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (anySheet && !showPalette) return;
        e.preventDefault();
        setShowPalette((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSettings, showUpdates, showDisk, showSecurity, showStars, showExport, showDoctor, showDeps, showThemes, showDescribe, readmeRepo, showPalette]);

  const c = (id: string, label: string, run: () => void): PaletteCommand => ({ id, label, run: () => { setShowPalette(false); run(); } });
  const paletteCommands: PaletteCommand[] = [
    c("updates", "Check for updates", () => setShowUpdates(true)),
    c("disk", "Disk usage", () => setShowDisk(true)),
    c("security", "Security scan", () => setShowSecurity(true)),
    c("stars", "GitHub stars", () => { setShowStars(true); if (!ghStatusLoaded) loadGhStatus(); if (!starsLoaded && !starsLoading) loadStars(); }),
    c("export", "Export setup", () => setShowExport(true)),
    c("doctor", "Health check", () => setShowDoctor(true)),
    c("themes", "Themes", () => setShowThemes(true)),
    c("settings", "Settings", () => { setShowSettings(true); if (!ghStatusLoaded) loadGhStatus(); }),
    c("describe", "Describe items", () => setShowDescribe(true)),
    c("rescan", "Rescan library", () => { rescan(); }),
    c("theme", "Toggle light / dark", () => toggleTheme()),
  ];

  return (
    <MotionConfig reducedMotion="user">
      <main className="app">
        <div className="top">
          <Toolbar
            q={q}
            onQ={setQ}
            inputRef={searchRef}
            status={`${favorites.length + others.length} / ${status}`}
            items={items}
            facets={facets}
            onFacets={setFacets}
            groupBy={groupBy}
            onGroupBy={setGroupBy}
            showHidden={showHidden}
            onShowHidden={setShowHidden}
            hiddenCount={hiddenCount}
            onDescribeAll={() => setShowDescribe(true)}
            describeEnabled={describeBtn.enabled}
            describeReason={describeBtn.reason}
            describingAll={describingAll}
            updatesCount={outdatedIds.size}
            onUpdates={() => setShowUpdates(true)}
            updatesDisabled={updatesGated}
            onDisk={() => setShowDisk(true)}
            securityAlert={securityAlert}
            onSecurity={() => setShowSecurity(true)}
            securityDisabled={securityGated}
            onStars={() => { setShowStars(true); if (!ghStatusLoaded) loadGhStatus(); if (!starsLoaded && !starsLoading) loadStars(); }}
            onExport={() => setShowExport(true)}
            onDoctor={() => setShowDoctor(true)}
            onSettings={() => { setShowSettings(true); if (!ghStatusLoaded) loadGhStatus(); }}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        </div>
        <div className="workspace">
          <div className="main-col">
            {loading ? (
              <SkeletonRows n={8} />
            ) : (
              <>
                <FavoritesGroup favorites={favorites} updates={updates} onSelect={setSelected} onToggleFavorite={toggleFavorite} selected={selected} describing={describing} />
                {others.length === 0 && items.length > 0 ? (
                  <div className="empty">
                    <div className="big">No tools match your filters.</div>
                    <button
                      className="ghost"
                      onClick={() => {
                        setFacets({ sources: [], tags: [], needsEnrichmentOnly: false, outdatedOnly: false });
                        setShowHidden(false);
                        setQ("");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <VirtualItemList rows={groupRows(others, groupBy, collapsedGroups)} onToggleGroup={toggleGroup} updates={updates} onSelect={setSelected} onToggleFavorite={toggleFavorite} selected={selected} describing={describing} />
                )}
              </>
            )}
          </div>
          <AnimatePresence>
            {selected && (
              <DetailSidebar
                key="detail"
                item={selected}
                activeProvider={activeProvider}
                online={online}
                update={updates[selected.id] ?? null}
                disk={disk[selected.id] ?? null}
                security={security[selected.id] ?? null}
                escEnabled={!showDoctor && !showUpdates && !showSettings && !showDisk && !showSecurity && !showExport && !showDeps && !showStars && !showDescribe && !showThemes && !readmeRepo}
                onClose={() => setSelected(null)}
                onSave={onDetailSave}
                onDescribe={describeItem}
                onStopDescribe={stopItem}
                describing={describing.has(selected.id)}
              />
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {showDoctor && (
            <Sheet key="doctor" title="Doctor" onClose={() => setShowDoctor(false)}>
              <DoctorView />
            </Sheet>
          )}
          {showUpdates && (
            <Sheet key="updates" title="Updates" width={760} onClose={() => setShowUpdates(false)}>
              <UpdatesView
                outdated={items.filter((it) => updates[it.id])}
                updates={updates}
                progress={progress}
                online={online}
                checking={checkingUpdates}
                onRecheck={checkUpdates}
                onClose={() => setShowUpdates(false)}
              />
            </Sheet>
          )}
          {showSettings && config && (
            <Sheet key="settings" title="Settings" onClose={() => setShowSettings(false)}>
              <SettingsView config={config} online={online} onClose={() => setShowSettings(false)} onSaveProvider={saveProvider}
                onRescan={rescan} scanning={scanning} itemCount={items.length} onOpenDeps={() => { setShowSettings(false); setDepsOnlyMissing(true); setShowDeps(true); }}
                githubClientId={config.github_client_id} onSaveGithubClientId={saveGithubClientId}
                ghStatus={ghStatus} onGhChanged={loadGhStatus}
                nvdApiKey={config.nvd_api_key} onSaveNvdKey={saveNvdKey}
                onOpenThemes={() => { setShowSettings(false); setShowThemes(true); }} />
            </Sheet>
          )}
          {showThemes && (
            <Sheet key="themes" title="Themes" width={760} onClose={() => { setShowThemes(false); restoreActive(); }}>
              <ThemesView themes={themes} activeId={activeTheme} defaults={modeDefaults} onSelect={(id) => selectTheme(id)}
                onSave={saveTheme} onDelete={deleteTheme} onApplyPreview={applyTheme} onRestore={restoreActive}
                describeEnabled={describeBtn.enabled} describeReason={describeBtn.reason} />
            </Sheet>
          )}
          {showDisk && (
            <Sheet key="disk" title="Disk" width={760} onClose={() => setShowDisk(false)}>
              <DiskView
                items={items}
                disk={disk}
                analyzing={analyzingDisk}
                progress={diskProgress}
                onAnalyze={analyzeDisk}
              />
            </Sheet>
          )}
          {showSecurity && (
            <Sheet key="security" title="Security" width={760} onClose={() => setShowSecurity(false)}>
              <SecurityView
                findings={Object.values(security)}
                scanning={scanningSecurity}
                scanned={securityScanned}
                progress={securityProgress}
                online={online}
                onScan={scanSecurity}
                nvdKeySet={!!config?.nvd_api_key}
                hbCves={hbCves}
                hbScanning={hbScanning}
                hbProgress={hbProgress}
                onScanHomebrew={scanHomebrewCves}
              />
            </Sheet>
          )}
          {showDescribe && (
            <Sheet key="describe" title="Describe items" onClose={() => setShowDescribe(false)}>
              <DescribeView
                items={items}
                onDescribe={describeMany}
                onStop={stopDescribeAll}
                busy={describingAll}
                progress={describeProgress}
              />
            </Sheet>
          )}
          {showStars && (
            <Sheet key="stars" title="GitHub Stars" width={780} onClose={() => setShowStars(false)}>
              <StarsView items={items} repos={stars} starred={starred} loading={starsLoading}
                connected={ghStatus ? ghStatus.connected : true} onRefresh={loadStars} onToggle={toggleStar} onReadme={setReadmeRepo} />
            </Sheet>
          )}
          {readmeRepo && (
            <Sheet key="readme" title={readmeRepo.full_name} width={820} onClose={() => setReadmeRepo(null)}>
              <ReadmeView repo={readmeRepo} />
            </Sheet>
          )}
          {showExport && (
            <Sheet key="export" title="Export" width={760} onClose={() => setShowExport(false)}>
              <ExportView items={items} />
            </Sheet>
          )}
          {showDeps && (
            <Sheet key="deps" title={depsOnlyMissing ? "Dependencies" : "Some tools aren't installed"} onClose={dismissDeps}>
              <DependencyView deps={deps} onlyMissing={depsOnlyMissing} />
              <div className="actions" style={{ marginTop: "18px" }}>
                <button className="primary" onClick={dismissDeps}>Got it</button>
              </div>
            </Sheet>
          )}
        </AnimatePresence>
      </main>
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} commands={paletteCommands}
        items={items} onPickItem={(it) => { setShowPalette(false); setSelected(it); }} />
      <Toaster theme={isDark ? "dark" : "light"} position="bottom-right"
        toastOptions={{ style: { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--line2)" } }} />
    </MotionConfig>
  );
}
