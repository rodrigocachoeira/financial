import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations use the direct connection when there is one (Neon); the app itself always uses DATABASE_URL.
    // Empty when only generating the client (build, CI).
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
