import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": src(""),
      // "server-only" throws outside a React Server Components bundle; stub it in tests.
      "server-only": src("test/empty.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
