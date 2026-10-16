import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Database tests share one SQLite file per file; running files one at a time keeps them independent and simple.
    fileParallelism: false,
  },
});
