import { BASE_PATH } from "./base-path";

// Sandbox-readiness rule 2 (SLD_SANDBOX_READINESS_RULES.md): ANYTHING that
// leaves the app — an invite e-mail, a printed access-code sheet, a PDF, a QR
// code — builds its absolute URL from ONE configured base URL, never a
// hard-coded domain. `APP_BASE_URL` is the origin (no trailing slash);
// BASE_PATH ("" today, "/sandbox" later) is appended so the same code produces
// the right link in both deployments.
//
// Unset today (nothing yet depends on an absolute URL at runtime): callers get
// null and must degrade to a relative path or omit the link, never invent a
// domain. Pure + unit-tested.
export function appBaseUrl(
  env: string | undefined = process.env.APP_BASE_URL,
): string | null {
  const raw = env?.trim();
  if (!raw) return null;
  const origin = raw.replace(/\/+$/, "");
  return `${origin}${BASE_PATH}`;
}

// An absolute URL for an app path ("/login"), or null when no base URL is
// configured. The path is base-path-relative, exactly like a <Link> href.
export function appUrl(
  path: string,
  env: string | undefined = process.env.APP_BASE_URL,
): string | null {
  const base = appBaseUrl(env);
  if (!base) return null;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
