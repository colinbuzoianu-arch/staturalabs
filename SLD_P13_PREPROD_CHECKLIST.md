# P13 §4 — Pre-production checklist (status)

The approved plan's §4 list, with what was built now (unattended, highest-value
first) and what is deferred with a reason. Each built item is verified; infra-
or browser-dependent steps are flagged as staging work, consistent with the
RLS (§1) and MFA (§4) flag-gated rollouts.

## Built
- **Security headers** — `src/lib/security/headers.ts`, applied to every
  response via `next.config.ts` `headers()`. HSTS (2y, preload), `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` denying camera/microphone/geolocation/payment,
  `X-DNS-Prefetch-Control: off`. Verified live (curl) on `/` and `/healthz`.
- **CSP (report-only)** — shipped as `Content-Security-Policy-Report-Only` so it
  cannot break Next's inline bootstrap. Promote to enforcing (nonce-based
  `script-src`) after a staging browser pass; documented in the headers file.
- **Health surface** — `GET /healthz` (unauthenticated, no tenant data): 200
  `{ok:true}` on a live DB probe, 503 otherwise. Verified live.
- **Error surface** — `src/app/global-error.tsx` root boundary with a generic,
  data-free fallback; reports through `src/lib/observability/report-error.ts`,
  a single seam that a Sentry-style provider drops into behind
  `ERROR_MONITORING_DSN` with no call-site change.
- **Dependency vulnerability scan in CI** — `.github/workflows/ci.yml` runs
  tsc + Biome + Vitest on push/PR, and a separate job fails on a high/critical
  **production** advisory (`npm audit --audit-level=high --omit=dev`). Brought
  the tree to **0 prod vulnerabilities**: `npm audit fix` cleared 13 transitive
  advisories and Next.js `16.2.10 → 16.4.6` cleared the remaining critical RCE /
  SSRF / cache-poisoning advisories. Re-verified: tsc/Biome/Vitest green and a
  full `next build` succeeds on 16.4.6.
- **i18n completeness test** — `src/lib/i18n/i18n-completeness.test.ts`: every
  area's DE/RO cover exactly the EN key set, with no empty strings (14 cases
  across all 7 dictionary areas). Backstops the `typeof en` compile-time check.
- **MFA (TOTP)** — built in §4's own slice (SLD_P13_MFA_ROLLOUT.md).

## Deferred (with reason)
- **Rate limiting** — a correct limiter needs a shared store (Upstash / Vercel
  KV / Redis); an in-memory limiter on serverless is per-instance and gives
  false assurance. Deferred to the real deployment, where the store exists. (The
  Supabase auth endpoint already rate-limits sign-in server-side.)
- **Backup & restore drill** — depends on the live Supabase project (enable
  point-in-time recovery, restore to a scratch DB, run the suite). A documented
  procedure for staging, not code.
- **axe-core accessibility pass** — needs a browser/CI harness; the i18n-
  completeness half is done. Add the axe pass when the CI browser runner exists.
- **Performance / index review** — an analysis pass over the hottest queries
  (hub, matrix, site rollups) and list-page pagination; scheduled against real
  query plans on staging data rather than guessed now.
- **Seed/fixture consolidation (2–3 tenants, AT+DE+CH gap)** — the demo fixture
  already stands up a realistic AT+DE multi-site tenant with a CH honest gap;
  broadening it to multiple tenants is a follow-up, not blocking.
