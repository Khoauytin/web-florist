import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests share one database, so run files one at a time.
    fileParallelism: false,
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
