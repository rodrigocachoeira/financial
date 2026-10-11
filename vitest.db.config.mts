import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the Postgres test database. Run with `yarn test:db`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["test/db-global-setup.ts"],
    fileParallelism: false,
  },
});
