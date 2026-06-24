import { describe, it, expect } from "vitest";
import { humanizeBytes, barPct } from "./diskFormat";

describe("humanizeBytes", () => {
  it("handles null and small", () => {
    expect(humanizeBytes(null)).toBe("—");
    expect(humanizeBytes(0)).toBe("0 B");
    expect(humanizeBytes(512)).toBe("512 B");
  });
  it("scales KB/MB/GB", () => {
    expect(humanizeBytes(1536)).toBe("1.5 KB");
    expect(humanizeBytes(4_404_019)).toBe("4.2 MB");
    expect(humanizeBytes(1_181_116_006)).toBe("1.1 GB");
  });
});

describe("barPct", () => {
  it("scales and clamps", () => {
    expect(barPct(50, 100)).toBe(50);
    expect(barPct(1, 100)).toBe(2); // min 2
    expect(barPct(200, 100)).toBe(100); // clamp
    expect(barPct(5, 0)).toBe(0); // no max
  });
});
