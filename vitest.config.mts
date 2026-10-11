import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Database tests need Postgres; they run with `yarn test:db`.
    exclude: ["src/**/*.db.test.ts", "node_modules/**"],
  },
});
