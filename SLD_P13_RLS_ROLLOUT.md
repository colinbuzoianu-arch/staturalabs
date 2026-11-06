# P13 §1 — RLS rollout (staging → production)

RLS policies and the non-owning `statura_app` role are **built and proven at the
DB level** (migration `20261110100000_rls_policies_and_app_role`). They are
inert today because the runtime connects as the table **owner**, which bypasses
RLS. This is deliberate: nothing changes until the runtime switches to the
non-owning role, which is a staging step verified before it becomes default.

## What's in place
- `statura_app` role (NOLOGIN) with least-privilege grants (SELECT/INSERT/UPDATE/
  DELETE, no DDL, not an owner, not BYPASSRLS) and default privileges for future
  tables.
- One `app_rls` policy per table (100/100): tenant roots scoped by the
  `app.company_ids` session GUC; every descendant inherits visibility through its
  parent FK (nested-RLS composition); shared reference/catalogue tables readable
  by all app sessions. Fail-closed: no GUC ⇒ no tenant rows.
- Proof (throwaway `SET ROLE statura_app` test, DB-level): scoped to company A,
  company B's sites/workstations/persons/findings all return 0; unset GUC ⇒ 0;
  globals still visible; owner bypasses. See the P13 §1 commit message.
- Runtime seam: `src/lib/db/tenant-scope.ts` — `isRlsEnforced()` + `withCompanyScope()`,
  gated by `RLS_ENFORCED` (default off = no-op passthrough).

## Staging rollout steps (do with the real infra, verify before default)
1. Give `statura_app` a login + password: `ALTER ROLE statura_app LOGIN PASSWORD '…';`
   (store the secret in the platform's secret manager, EU region).
2. Point the runtime `DATABASE_URL` at `statura_app`; keep `DIRECT_URL` on the
   owning role for migrations/seeds only.
3. Set `RLS_ENFORCED=true` on staging.
4. Wrap each authenticated request's data access in `withCompanyScope(companyIds, …)`,
   resolving `companyIds` from the signed-in user (company_admin → own company;
   site_admin → company of assigned sites; super_admin → handled via `/admin`,
   which stays owner-connected or uses an unscoped path by design).
5. Run the full suite and the key HTTP flows against staging under the app role;
   confirm no feature regresses and that a hand-crafted cross-tenant request
   returns nothing.
6. Promote to production only after staging is green.

## Notes
- The owner connection (migrations/seed) is unaffected — it bypasses RLS, so
  `prisma migrate deploy` and the fixture scripts keep working unchanged.
- Catalogue activation stays super_admin-only at the app layer (ERGO §3.14); the
  catalogue tables are shared-readable under RLS but writes still go through the
  super-admin console / migrations.
- Tightening any table that defaulted to shared-read: none did beyond the
  intended global set (verified — 0 unintended leftovers).
