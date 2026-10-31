// The one redirect map (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.3, §10:
// "Every old URL redirects"). P1 moved every authenticated page under the new
// /app prefix; these permanent redirects keep every pre-/app bookmark, email
// link and external reference working. Pure data + a pure resolver, no imports,
// so next.config.ts can consume it and legacy-redirects.test.ts can assert
// every old top-level pattern resolves.
//
// Flat prefix by design: the deeper /app/s/[siteId]/<module> IA re-nesting is
// P2's per-module page migration; P1 settles the /app prefix and the redirect
// mechanism. When a page's URL changes again in P2, add its specific old->new
// pair here — this stays the single place that owns "every old URL redirects."

// The authenticated top-level segments that moved under /app. /admin, /api,
// /login and the marketing routes are deliberately NOT prefixed and must never
// appear here.
export const RELOCATED_TOP_LEVEL_SEGMENTS = [
  "sites",
  "workstations",
  "tasks",
  "administration",
] as const;

export type RedirectSpec = {
  source: string;
  destination: string;
  permanent: boolean;
};

// Next.js redirect specs. `:path*` matches zero or more segments, so
// `/sites/:path*` covers `/sites` itself and everything under it; query
// strings are preserved by Next automatically.
export const LEGACY_REDIRECTS: readonly RedirectSpec[] =
  RELOCATED_TOP_LEVEL_SEGMENTS.map((seg) => ({
    source: `/${seg}/:path*`,
    destination: `/app/${seg}/:path*`,
    permanent: true,
  }));

// Pure resolver mirroring the redirect specs above — returns the /app
// destination for a relocated pre-/app path, or null for a path that is not
// relocated (already /app, or /admin, /api, /login, marketing). Used by the
// test to prove every old pattern resolves, and available to any server code
// that needs to compute an old->new mapping.
export function resolveLegacyRedirect(pathname: string): string | null {
  for (const seg of RELOCATED_TOP_LEVEL_SEGMENTS) {
    if (pathname === `/${seg}` || pathname.startsWith(`/${seg}/`)) {
      return `/app${pathname}`;
    }
  }
  return null;
}
