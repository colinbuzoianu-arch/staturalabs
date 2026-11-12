import type { NextConfig } from "next";
import { LEGACY_REDIRECTS } from "./src/lib/routes/legacy-redirects";
import { MODULE_MIGRATION_REDIRECTS } from "./src/lib/routes/module-redirects";
import { SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  // Permanent redirects: the pre-/app URL structure (legacy-redirects.ts) and
  // intra-/app module re-homings from the P2 migration (module-redirects.ts).
  // Both are shared data so they stay the single source and are unit-tested.
  async redirects() {
    // The /[country] marketing URLs (/at, /de, /ch and their /about, /legal)
    // were retired with the single German-default marketing site. 301 any old
    // country URL to its new home so indexed links keep working.
    const countryRedirects = ["at", "de", "ch"].flatMap((c) => [
      // Bare /at → / (the `:path*` rule below would resolve to an empty
      // destination for the zero-segment case, so handle it explicitly).
      { source: `/${c}`, destination: "/", permanent: true },
      // /at/about → /about, /at/legal → /legal (one or more segments).
      { source: `/${c}/:path+`, destination: "/:path+", permanent: true },
    ]);
    return [
      ...countryRedirects,
      ...LEGACY_REDIRECTS,
      ...MODULE_MIGRATION_REDIRECTS,
    ].map((r) => ({ ...r }));
  },
  // P13 §4: security headers on every response (SECURITY_HEADERS is the single
  // source; CSP ships report-only, see that file).
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
