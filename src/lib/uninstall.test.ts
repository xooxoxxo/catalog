import { describe, it, expect } from "vitest";
import { uninstallCommand } from "./uninstall";

describe("uninstallCommand", () => {
  it("brew + cask", () => {
    expect(uninstallCommand({ source: "brew", name: "llvm", id: "brew:llvm" })).toBe("brew uninstall llvm");
    expect(uninstallCommand({ source: "cask", name: "Ghostty", id: "cask:ghostty" })).toBe("brew uninstall --cask ghostty");
  });
  it("language managers", () => {
    expect(uninstallCommand({ source: "npm", name: "prettier", id: "npm:prettier" })).toBe("npm -g uninstall prettier");
    expect(uninstallCommand({ source: "pipx", name: "poetry", id: "pipx:poetry" })).toBe("pipx uninstall poetry");
  });
  it("apps/orphans have no CLI", () => {
    expect(uninstallCommand({ source: "app", name: "Xcode", id: "app:com.apple.dt.Xcode" })).toBeNull();
    expect(uninstallCommand({ source: "orphan", name: "foo", id: "orphan:/usr/local/bin/foo" })).toBeNull();
  });
});
