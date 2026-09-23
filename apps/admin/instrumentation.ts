/**
 * Runs once when the server starts, before it takes requests: refuses to start in
 * production with missing or placeholder secrets, then schedules the daily purge of
 * page views older than the retention window.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { checkEnv, visitRetentionDays } = await import("./lib/env");
  const production = process.env.NODE_ENV === "production";
  const problems = checkEnv(process.env, production);
  if (problems.length) {
    const summary = problems.map((problem) => `${problem.name} ${problem.problem}`).join("; ");
    if (production) {
      // Exit rather than throw: Next logs an error thrown here and serves anyway, and a
      // dashboard with a guessable password must not come up at all.
      console.error(`[admin] Refusing to start: ${summary}`);
      process.exit(1);
    }
    console.warn(`[admin] configuration: ${summary}`);
    return;
  }

  const { purgeOldVisits } = await import("./lib/queries");
  const days = visitRetentionDays();
  const purge = async () => {
    try {
      const removed = await purgeOldVisits(days);
      if (removed) console.log(JSON.stringify({ level: "info", event: "visits_purged", removed, retentionDays: days }));
    } catch (error) {
      console.error(JSON.stringify({ level: "error", event: "visits_purge_failed", message: error instanceof Error ? error.message : String(error) }));
    }
  };
  // A minute after start, then daily. unref() so the timers never hold a shutdown open.
  setTimeout(purge, 60_000).unref();
  setInterval(purge, 24 * 60 * 60 * 1000).unref();
}
