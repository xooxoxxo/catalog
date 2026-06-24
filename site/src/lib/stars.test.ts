import { describe, it, expect, vi } from "vitest";
import { formatStars, fetchStarCount } from "./stars";

describe("formatStars", () => {
  it("adds thousands separators", () => {
    expect(formatStars(1247)).toBe("1,247");
  });
  it("handles zero", () => {
    expect(formatStars(0)).toBe("0");
  });
  it("handles millions", () => {
    expect(formatStars(1000000)).toBe("1,000,000");
  });
});

describe("fetchStarCount", () => {
  const ok = (count: number) =>
    ({ ok: true, json: async () => ({ stargazers_count: count }) }) as Response;

  it("returns the star count on success", async () => {
    const fetchImpl = vi.fn(async () => ok(42));
    expect(await fetchStarCount({ fetchImpl })).toBe(42);
  });

  it("returns null on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false }) as Response);
    expect(await fetchStarCount({ fetchImpl })).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("offline"); });
    expect(await fetchStarCount({ fetchImpl })).toBeNull();
  });

  it("returns null when the field is missing", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as Response);
    expect(await fetchStarCount({ fetchImpl })).toBeNull();
  });

  it("sends an Authorization header when a token is given", async () => {
    const fetchImpl = vi.fn(async () => ok(7));
    await fetchStarCount({ fetchImpl, token: "abc" });
    const [, init] = fetchImpl.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer abc" });
  });
});
