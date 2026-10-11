import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Empty when only generating the client (build, CI); commands that reach the database need it set.
    url: process.env.DATABASE_URL ?? "",
  },
});
