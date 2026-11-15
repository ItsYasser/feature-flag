import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests run against an in-memory embedded Postgres — no DATABASE_URL needed.
    env: { DATABASE_URL: "pglite://memory" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
