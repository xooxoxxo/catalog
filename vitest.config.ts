import { defineConfig } from "vitest/config";
export default defineConfig({
  // Scope to the app's own tests. The Astro site (site/) has its own deps and
  // test runner; left unscoped, vitest would glob site/**/*.test.ts and fail to
  // resolve astro's tsconfig when only the root deps are installed (e.g. in CI).
  test: { environment: "jsdom", globals: true, include: ["src/**/*.test.{ts,tsx}"] },
});
