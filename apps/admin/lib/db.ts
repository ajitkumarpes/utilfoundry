import postgres from "postgres";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

// Cached on the global object so `next dev`'s fast refresh, which re-evaluates this
// module on every edit, reuses one connection pool instead of opening a new one each
// time (the same problem every Postgres-on-Next.js setup hits, this is the standard fix).
const globalForSql = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql = globalForSql.sql ?? postgres(requireEnv("DATABASE_URL"), { max: 10 });

if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;
