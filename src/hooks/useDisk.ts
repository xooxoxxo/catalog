import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { notify } from "../lib/notify";
import type { DiskInfo, DiskProgress } from "../types";

/** On-disk size measurement per tool, with live progress. */
export function useDisk() {
  const [disk, setDisk] = useState<Record<string, DiskInfo>>({});
  const [analyzingDisk, setAnalyzingDisk] = useState(false);
  const [diskProgress, setDiskProgress] = useState<DiskProgress | null>(null);

  const analyzeDisk = async () => {
    setAnalyzingDisk(true);
    setDiskProgress(null);
    try {
      const list = await invoke<DiskInfo[]>("analyze_disk");
      const map: Record<string, DiskInfo> = {};
      for (const d of list) map[d.id] = d;
      setDisk(map);
      notify("Disk analysis complete", `${list.length} item${list.length > 1 ? "s" : ""} measured`);
    } catch {
      /* keep prior map */
    } finally {
      setAnalyzingDisk(false);
    }
  };

  useEffect(() => {
    const un = listen<DiskProgress>("disk-progress", (e) => setDiskProgress(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, []);

  return { disk, analyzingDisk, diskProgress, analyzeDisk };
}
