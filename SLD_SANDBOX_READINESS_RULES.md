# SLD — Sandbox readiness rules (standing rule, applies to all future work)

**Set by:** Colin Buzoianu (founder), 2026-11-14. **Copy this section into CLAUDE.md** under the standing rules, and follow it in every milestone from now on.

## The plan
Later, the **whole platform** will run as a prospecting sandbox at **`staturalabs.com/sandbox`**: same code, every module, separate data, seeded demo content, used by prospects. **It is not built now.** Today's work must just not make it hard to add.

## Assumed shape (so code stays compatible)
- **A second deployment of the same codebase**, built with base path `/sandbox`. The main project rewrites `staturalabs.com/sandbox/*` to it.
- **Its own database and storage** (separate Supabase project), so prospect data and real customer data can never mix.
- Environment chosen by configuration (`APP_ENVIRONMENT = production | sandbox`), never by code branches scattered through the app.

## Rules for everything you build from now on
1. **Base-path safe.** No hard-coded absolute paths in links, redirects, middleware, server actions or API calls. Use the framework's link/redirect helpers that respect the base path. The redirect map and middleware matchers must work with and without `/sandbox`.
2. **Absolute URLs from configuration.** Anything that leaves the app (PDF links, e-mail links, invite links, auth callback URLs, QR codes for anonymous reporting, generated documents) is built from one configured base URL, never assembled from a hard-coded domain.
3. **No shared state between environments.** Auth cookies must not collide between `/` and `/sandbox` on the same domain: cookie path or name per environment. Storage paths, cache keys and job queues are per environment.
4. **Environment-driven defaults, not hard-coded ones.** Feature-flag defaults, module entitlements for new tenants, AI usage caps and banners are resolved from `APP_ENVIRONMENT`. No per-environment `if` scattered in pages; one resolver.
5. **Seeds as code.** Demo data that a sandbox will need (products, SDS, sites, fictional persons, assessments) is defined in idempotent, tenant-scoped seed scripts, never only as manual data in one database.
6. **Fictional data only in seeds.** Fictional company, product, supplier and person names. Real substances and real legal references are fine.
7. **Background jobs are environment-aware.** Retention/anonymisation jobs, notifications and expiry logic run per environment and never touch the other environment's data.
8. **E-mails from the sandbox** must be clearly marked or suppressed by configuration, so a prospect test never sends a real-looking notification to a real address by accident.
9. **Tests:** add one check that the app builds and the main routes resolve with base path `/sandbox`. Keep it green from now on.

## Not now (the later sandbox milestone)
Prospect tenant creation and lifecycle (expiry, deletion), the permanent "Demo-Umgebung" band, sandbox-specific AI caps, the sandbox deployment itself, and the `staturalabs.com/sandbox` rewrite. These come in a dedicated milestone when the founder asks for it.
