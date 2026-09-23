/**
 * Configuration checks run once at server start (instrumentation.ts), so a production
 * container with a missing or placeholder secret refuses to start instead of serving an
 * admin panel anyone could guess their way into.
 */

const PLACEHOLDERS = ["replace-with-a-long-random-secret", "placeholder", "changeme", "change-me", "password", "admin"];

export type EnvProblem = { name: string; problem: string };

type Env = Record<string, string | undefined>;

function isPlaceholder(value: string) {
  return PLACEHOLDERS.includes(value.trim().toLowerCase());
}

export function checkEnv(env: Env, production: boolean): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const require = (name: string) => {
    const value = env[name]?.trim();
    if (!value) problems.push({ name, problem: "is not set" });
    return value ?? "";
  };

  const databaseUrl = require("DATABASE_URL");
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push({ name: "DATABASE_URL", problem: "must be a postgres:// connection string" });
  }

  const password = require("ADMIN_PASSWORD");
  const secret = require("ADMIN_SESSION_SECRET");
  if (!production) return problems;

  if (password && (password.length < 12 || isPlaceholder(password))) {
    problems.push({ name: "ADMIN_PASSWORD", problem: "must be at least 12 characters and not a placeholder" });
  }
  if (secret && (secret.length < 32 || isPlaceholder(secret))) {
    problems.push({ name: "ADMIN_SESSION_SECRET", problem: "must be at least 32 random characters (openssl rand -hex 32)" });
  }
  if (password && secret && password === secret) {
    problems.push({ name: "ADMIN_SESSION_SECRET", problem: "must differ from ADMIN_PASSWORD" });
  }

  const origins = (env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length) {
    problems.push({ name: "CORS_ALLOWED_ORIGINS", problem: "must list the sites allowed to send feedback and visits" });
  }
  for (const origin of origins) {
    // localhost is allowed over plain http so a production build can be tried on one machine.
    if (!/^https:\/\/[^/\s]+$/.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      problems.push({ name: "CORS_ALLOWED_ORIGINS", problem: `${origin} must be an https:// origin with no path` });
    }
  }

  const retention = env.VISIT_RETENTION_DAYS;
  if (retention !== undefined && retention !== "" && !(Number.isInteger(Number(retention)) && Number(retention) >= 1)) {
    problems.push({ name: "VISIT_RETENTION_DAYS", problem: "must be a whole number of days, 1 or more" });
  }
  return problems;
}

/** How long page-view records are kept before the daily purge removes them. */
export function visitRetentionDays(env: Env = process.env): number {
  const value = Number(env.VISIT_RETENTION_DAYS);
  return Number.isInteger(value) && value >= 1 ? value : 395;
}
