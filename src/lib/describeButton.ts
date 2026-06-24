import type { Provider } from "../types";

export interface ButtonState { enabled: boolean; reason: string; }

export function describeButtonState(provider: Provider | undefined, online: boolean): ButtonState {
  if (!provider || !provider.command.trim()) {
    return { enabled: false, reason: "Configure a provider in Settings" };
  }
  if (provider.requires_online && !online) {
    return { enabled: false, reason: "Needs internet" };
  }
  return { enabled: true, reason: "" };
}
