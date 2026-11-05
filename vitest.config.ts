import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Exists for one reason: the `@/` alias.
 *
 * Without it a test can only import by relative path, so the modules under
 * test and the tests drift into two different import styles, and the first
 * sign of it is a suite that fails to load rather than a test that fails.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
