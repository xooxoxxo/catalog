import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { notify } from "../lib/notify";
import type { SecurityFinding, SecurityProgress, NvdProgress } from "../types";

/**
 * Vulnerability scanning: the OSV pass (`scan_security`) and the optional
 * Homebrew/NVD CVE pass (`scan_homebrew_cves`), each with its own progress.
 * `setStatus` reports the Homebrew scan's failure into the app status bar.
 */
export function useSecurity({ setStatus }: { setStatus: (msg: string) => void }) {
  const [security, setSecurity] = useState<Record<string, SecurityFinding>>({});
  const [scanningSecurity, setScanningSecurity] = useState(false);
  const [securityScanned, setSecurityScanned] = useState(false);
  const [securityProgress, setSecurityProgress] = useState<SecurityProgress | null>(null);
  const [hbCves, setHbCves] = useState<SecurityFinding[]>([]);
  const [hbScanning, setHbScanning] = useState(false);
  const [hbProgress, setHbProgress] = useState<NvdProgress | null>(null);

  const scanSecurity = async () => {
    setScanningSecurity(true);
    setSecurityProgress(null);
    try {
      const list = await invoke<SecurityFinding[]>("scan_security");
      const map: Record<string, SecurityFinding> = {};
      for (const f of list) map[f.item_id] = f;
      setSecurity(map);
      notify(
        "Security scan complete",
        list.length ? `${list.length} package${list.length > 1 ? "s" : ""} with findings` : "No known vulnerabilities",
      );
    } catch {
      /* keep prior map */
    } finally {
      setScanningSecurity(false);
      setSecurityScanned(true);
    }
  };

  const scanHomebrewCves = async () => {
    setHbScanning(true);
    setHbProgress(null);
    try {
      const list = await invoke<SecurityFinding[]>("scan_homebrew_cves");
      setHbCves(list);
      notify(
        "Homebrew CVE scan complete",
        list.length ? `${list.length} formula${list.length > 1 ? "e" : ""} with CVEs` : "No CVEs matched",
      );
    } catch (e) {
      setStatus(`Homebrew CVE scan: ${String(e)}`);
      toast.error(`Homebrew CVE scan failed`);
    } finally {
      setHbScanning(false);
    }
  };

  useEffect(() => {
    const un = listen<SecurityProgress>("security-progress", (e) => setSecurityProgress(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const un = listen<NvdProgress>("nvd-progress", (e) => setHbProgress(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, []);

  return {
    security,
    scanningSecurity,
    securityScanned,
    securityProgress,
    scanSecurity,
    hbCves,
    hbScanning,
    hbProgress,
    scanHomebrewCves,
  };
}
