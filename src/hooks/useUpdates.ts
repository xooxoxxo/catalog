import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { notify } from "../lib/notify";
import type { Update, UpdateProgress } from "../types";

/** Available-update detection across sources, with live per-source progress. */
export function useUpdates() {
  const [updates, setUpdates] = useState<Record<string, { current: string; latest: string }>>({});
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [progress, setProgress] = useState<Record<string, { status: string; count: number }>>({});

  const checkUpdates = async () => {
    setCheckingUpdates(true);
    setProgress({});
    try {
      const list = await invoke<Update[]>("check_updates");
      const map: Record<string, { current: string; latest: string }> = {};
      for (const u of list) map[u.id] = { current: u.current, latest: u.latest };
      setUpdates(map);
      notify(
        "Update check complete",
        list.length ? `${list.length} update${list.length > 1 ? "s" : ""} available` : "Everything is up to date",
      );
    } catch {
      /* leave prior map */
    } finally {
      setCheckingUpdates(false);
    }
  };

  // live per-source progress
  useEffect(() => {
    const un = listen<UpdateProgress>("updates-progress", (e) => {
      setProgress((p) => ({ ...p, [e.payload.source]: { status: e.payload.status, count: e.payload.count } }));
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  return { updates, checkingUpdates, progress, checkUpdates };
}
