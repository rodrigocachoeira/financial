import { execSync } from "node:child_process";

/** Applies migrations to the test database before `yarn test:db` runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) {
    throw new Error('TEST_DATABASE_URL must be set and name a database ending with "_test"');
  }
  try {
    execSync("yarn prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url },
    });
  } catch (error) {
    const output = (error as { stdout?: Buffer; stderr?: Buffer });
    throw new Error(
      `Could not migrate the test database. Is the "db" container running?\n${output.stdout ?? ""}${output.stderr ?? ""}`,
    );
  }
}
