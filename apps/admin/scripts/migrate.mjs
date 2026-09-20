// Hand-rolled migration runner: applies db/migrations/*.sql in filename order, once
// each, tracked in schema_migrations. Runs on every `predev`/`db:migrate` and as the
// first step of the Docker container's start command, mirroring Flyway's on-boot
// migrate-then-serve pattern used by apps/pdf/backend without pulling Flyway in for
// what is otherwise a small, hand-written Node service.

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "db", "migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamp(6) with time zone NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = await sql`SELECT filename FROM schema_migrations`;
  const applied = new Set(appliedRows.map((row) => row.filename));

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const contents = readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Applying migration ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(contents);
      await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
