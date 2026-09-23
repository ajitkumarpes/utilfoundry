import postgres, { type Sql } from "postgres";

/**
 * The connection pool, created on first use rather than at import. `next build` imports
 * every route module to collect page data, and a Docker build has no DATABASE_URL — reading
 * it at import made the image unbuildable without dummy credentials baked into the build.
 */

// Cached on the global object so `next dev`'s fast refresh, which re-evaluates this module
// on every edit, reuses one pool instead of opening a new one each time.
const globalForSql = globalThis as unknown as { adminSql?: Sql };

export function db(): Sql {
  if (globalForSql.adminSql) return globalForSql.adminSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  globalForSql.adminSql = postgres(url, {
    max: 10,
    // Recycle idle and long-lived connections so a database restart or failover heals on
    // its own, and fail a request within seconds when the database is unreachable.
    idle_timeout: 30,
    max_lifetime: 60 * 30,
    connect_timeout: 10,
    onnotice: () => {}
  });
  return globalForSql.adminSql;
}
