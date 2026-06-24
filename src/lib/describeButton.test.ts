import { describe, it, expect } from "vitest";
import { describeButtonState } from "./describeButton";
import type { Provider } from "../types";

const claude: Provider = { command: "claude", args: ["-p", "{prompt}"], stdin: false, requires_online: true };
const ollama: Provider = { command: "ollama", args: ["run", "llama3.2"], stdin: true, requires_online: false };
const blank: Provider = { command: "", args: [], stdin: false, requires_online: false };

describe("describeButtonState", () => {
  it("disabled with reason when no command", () => {
    const s = describeButtonState(blank, true);
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/configure/i);
  });
  it("disabled when requires_online and offline", () => {
    const s = describeButtonState(claude, false);
    expect(s.enabled).toBe(false);
    expect(s.reason).toMatch(/internet/i);
  });
  it("enabled when online cloud provider", () => {
    expect(describeButtonState(claude, true).enabled).toBe(true);
  });
  it("enabled offline for local provider", () => {
    expect(describeButtonState(ollama, false).enabled).toBe(true);
  });
  it("disabled when provider undefined", () => {
    expect(describeButtonState(undefined, true).enabled).toBe(false);
  });
});
