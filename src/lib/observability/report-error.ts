// P13 §4 error-monitoring hook. A single seam so a real provider (Sentry-style)
// can be dropped in later via env config WITHOUT touching call sites. Today it
// logs to the server console in a structured shape; when ERROR_MONITORING_DSN is
// set, a provider SDK would be initialised here instead.
//
// Discipline (ERGO §3.x / P13 §6): NEVER pass person or health data into this —
// pass a message, an error, and tenant/entity ids only. The no-person-data-in-
// logs test guards the logging surface generally.
export function reportError(
  message: string,
  error?: unknown,
  context?: Record<string, string | number | null | undefined>,
): void {
  // Placeholder for the real DSN wiring (kept behind an env var so adding the
  // provider later needs no code change here).
  const dsn = process.env.ERROR_MONITORING_DSN;
  const payload = {
    level: "error",
    message,
    error: error instanceof Error ? error.message : String(error ?? ""),
    ...context,
  };
  if (dsn) {
    // A provider SDK (e.g. Sentry.captureException) would be invoked here.
    // Until one is configured, still emit structured output so nothing is lost.
    console.error("[monitored]", JSON.stringify(payload));
    return;
  }
  console.error("[error]", JSON.stringify(payload));
}
