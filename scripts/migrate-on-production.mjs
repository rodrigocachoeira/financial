// Runs during the Vercel build. Applies migrations only for production deployments,
// so preview builds never touch the real database.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  execSync("prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}
