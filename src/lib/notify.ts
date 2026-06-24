import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

/** In-app toast always; a native OS notification too when the window is unfocused
 *  (so a long scan that finished while you were elsewhere still reaches you). */
export async function notify(title: string, body?: string): Promise<void> {
  toast(title, body ? { description: body } : undefined);

  if (document.hasFocus()) return;
  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch { /* notifications unavailable — the toast already fired */ }
}
