# SLD P13 — Hardening, Super-Admin console & onboarding: founder-approved (revised scope)

**Approved by:** Colin Buzoianu (founder), 2026-11-05. This revises §8 of `SLD_RESTRUCTURE_PLAN_platform-modules.md` with the founder's scope decisions. Not a legal-content gate — CC builds this autonomously, same engineering rules as always (hand-written migrations, enum-first, RLS, `Restrict` FKs, append-only history, `AuditEvent` on every mutating admin action, DE/EN/RO, tsc/Biome/Vitest green per commit, slice by slice with commit + push).

## 0. Scope decisions

| §8 item | Decision |
|---|---|
| RLS policies + non-owner runtime DB role | **In.** The standing CLAUDE.md hardening item; purely internal. |
| **Super-Admin console** (per-tenant module unlock + more) | **In — the headline of P13.** Detailed in §2. |
| Onboarding wizard | **In** (§3), plus the pre-production work worth doing now (§4). |
| Data portability (export + documented deletion) | **In** (§5). |
| Ops / structured-logging hygiene / admin impersonation audit | **In** (§6). |
| Legal pack (AVV/DPA/TOMs) | **Templates only, as draft documents** (§7). Binding versions wait for the real deployment and your separate contract. |
| SSO (SAML/OIDC) | **Deferred** to the real-infrastructure pairing. Keep the clean offboarding/disable path (§6), which is what matters now. |
| Billing / plans / Stripe | **Dropped.** First customer is covered by a separate contract within the same company; no in-app billing. |

Nothing here weakens the compliance mandates: activation of `MethodologyVersion` / `RiskMatrixVersion` / any catalogue version stays `super_admin`-only and fail-closed (ERGO §3.14); the people compartment stays person-free of the assessment chain; health-compartment reads stay audited.

---

## 1. RLS policies + non-owner runtime role

CLAUDE.md's open item: RLS is *enabled* on every table but has *no policies*, which only works because the runtime role owns the tables and bypasses RLS. Close it.

1. Write explicit RLS policies for every table, keyed on the tenant boundary the app already enforces in code (company/site scope). Policies mirror the `require*Access` logic, they don't replace it — defence in depth.
2. Introduce a **non-owning application DB role** for the runtime connection (`DATABASE_URL`), keep the owning role only for migrations (`DIRECT_URL`).
3. Prove it: a test that, as the app role, a query crossing a tenant boundary returns zero rows at the DB level even if the app-layer check were bypassed; and that every existing feature still works under the app role (run the suite against it).
4. Roll out behind a flag so it can be verified on a staging DB before it becomes the default. This is the single most valuable hardening step pre-production — do it first.

---

## 2. Super-Admin console

Expands the existing `/admin` surface (super_admin / l3_support only; `super_admin` is already routed here and away from `(app)`). Keep `/admin`'s plain styling unless you ask otherwise — it's your internal tool, not a customer surface. Every action writes an `AuditEvent` with the acting super-admin, and `/admin` actions are allowed to cross tenants (that is the whole point of the role), so the audit trail is the control.

### 2.1 Tenant (company) management
- List all companies with: site count, active-module count, user count, created date, `demo`/`pilot` marker (from `pilotContext`), archived state.
- Create a tenant: name, country of the first site, then invite its first `company_admin` (email). No public sign-up anywhere, unchanged.
- Archive / unarchive a tenant (soft `status`, never physical delete — ERGO §3.9). Archived tenants' users can't sign in; data is retained.
- Open a tenant to see its sites, org tree and module state (read-mostly; deep edits stay in the tenant's own admin).

### 2.2 Per-tenant module entitlement (the core ask)
- A matrix: tenants × modules, each cell a toggle, writing `CompanyModule` (built in P1, super_admin-only). Unlocking adds the module to that tenant's sidebar; locking removes it and 404s its routes (the P1 behaviour). No half-states.
- Respect the registry's module `status`: a `planned` module can't be unlocked for anyone; a `beta` module can be unlocked per tenant with a "Beta" badge shown in the tenant's nav.
- A **default entitlement template** for new tenants (e.g. cockpit, risk, actions, documents, settings on; others off), editable, applied at tenant creation and overridable per tenant afterwards.
- Bulk apply a template to an existing tenant (with a confirm + audit).
- Show, per module per tenant, who toggled it and when (from `CompanyModule` + audit).

### 2.3 Catalogue version control (super-admin-only, fail-closed)
One place to see and activate the single-active-version catalogues, each keeping its fail-closed contract (activation never leaves zero active; activation is super-admin-only; ERGO §3.14):
- `MethodologyVersion`, `RiskMatrixVersion`, `ExposureLimitCatalogVersion`, `LegalReferenceCatalogVersion`, `TypicalMeasureCatalogVersion`, `RetentionRuleCatalogVersion`, `IncidentNotificationCatalogVersion`, `LegalRequirementCatalogVersion`.
- For each: list versions, show which is active, show row counts, activate a different version in one audited action with a confirm. Activating is the only write here — authoring/seeding stays in migrations/seeds, not hand-editing in the UI.
- Show each version's `verifiedBy`/`verifiedAt`/`verificationMethod` so you can see the provenance before activating.

### 2.4 Cross-tenant operations
- **Audit log viewer:** `AuditEvent` across all tenants, filterable by tenant, actor, action type, entity, date. Read-only. Health-compartment read events show that a read occurred and by whom, never the health content.
- **User & role overview:** every `PlatformUser` and `RoleAssignment` across tenants; grant/revoke the platform roles (`company_admin` and below) and the `l3_support` role; disable an account immediately. `super_admin` grants stay a deliberate, audited, super-admin-only action.
- **Demo/pilot hygiene:** list all sessions/assessments carrying a `pilotContext`, so demo data stays visibly separate from real customer data; the existing `reset:demo` / `seed:demo` scripts get an `/admin` button (guarded by the same name-marker safety check the scripts already enforce).
- **Impersonation (read-only first):** open a tenant's dashboard as a read-only view "as this company_admin", for support. Every impersonation session writes an `AuditEvent` and shows a persistent banner. No write actions while impersonating in v1 (revisit only if support needs it).

### 2.5 Feature flags (lightweight)
A simple `super_admin`-settable flag store (per-tenant or global) for rolling a `beta` module or a risky change to one tenant first. Data-driven, audited. Not a full experimentation platform — just an on/off per key per tenant.

---

## 3. Onboarding wizard

A guided first-run for a new tenant's `company_admin` (the super-admin has already created the tenant and unlocked its modules):
1. **Company & first site:** confirm company name, add the first site with its **country** (drives the whole legal layer — mandatory, never defaulted).
2. **Organisation:** build or CSV-import the org tree (plant → departments → areas/lines) and the first workstations; or skip and do it later.
3. **People (optional):** CSV-import the person register (dry-run first, per P7b), or skip.
4. **First assessment:** offer to start one Evaluierung on the first workstation, landing the user in the hub they'll actually use.
5. **Sample data toggle:** load a clearly-marked sample dataset for the tenant to explore, removable in one click (reuses the demo-fixture machinery, tenant-scoped and `pilotContext`-marked so it can never be mistaken for real data).
Progress is resumable; the wizard is skippable; nothing it does is irreversible.

---

## 4. Pre-production work worth doing now (the investigation you asked for)

Things that are valuable before any real deployment, need no external service, and no customer decision:

- **Security headers & CSP** on all responses; **rate limiting** on auth and API routes; dependency vulnerability scan wired into CI (fails the build on a high severity). Internal, high value.
- **Backup & restore drill:** confirm point-in-time recovery is on for the Supabase project and script a documented restore-test (restore to a scratch DB, run the suite). Do it once now so it isn't discovered broken later.
- **MFA (TOTP)** for `super_admin`, `l3_support`, `company_admin`, `ehs_specialist`, `occupational_physician` — this is internal (an authenticator app), unlike SSO, and protects exactly the high-privilege and health-data roles. Worth doing now; SSO stays deferred.
- **Accessibility & i18n completeness pass:** a test that every user-facing string resolves in DE/EN/RO (no missing keys), and an axe-core pass on the main flows. Cheap to add, painful to retrofit.
- **Error & health surface:** a `/healthz` endpoint, a structured error boundary, and error-monitoring hooks (Sentry-style) behind an env var so the real DSN is dropped in later without code change.
- **Seed/fixture consolidation:** one documented path to stand up a realistic multi-tenant demo (2–3 tenants, AT + DE + a CH gap site) for sales demos and for your own testing.
- **Performance sanity:** index review on the hottest queries (the hub, the matrix, the site rollups) and a check that list pages paginate rather than load everything.

CC should propose this §4 list as a checklist, let you tick which to do now, and build the ticked ones. (If you're away, it does them in the order above, which is roughly highest-value-first.)

---

## 5. Data portability & deletion

- **Full tenant export:** one super-admin (or company_admin, scoped to their own company) action producing a complete export of a company — structured data (JSON) plus the stored documents — as a downloadable archive. Person data included only where the requester is entitled to it; health-compartment content gated and audited.
- **Documented deletion at contract end:** a deliberate, logged, super-admin-only hard-delete path for a company, separate from archiving, honouring the `Restrict` FK discipline (delete leaf-to-root, like `reset:demo`), behind a double confirm and an `AuditEvent`. Never an accidental side effect.
- **Data-subject export** (one person's records across the people compartment) already specified in P7 — make sure it's reachable here too.

---

## 6. Ops, logging & offboarding

- **Structured logging with no person data:** logs carry tenant/site/entity ids and event types, never a worker name or health detail. Add a test/lint that flags obvious person-data in log calls.
- **Admin impersonation audit:** as §2.4 — persistent banner + `AuditEvent`.
- **Clean offboarding now (SSO later):** account disable is immediate and complete (no lingering sessions), role revocation keeps history. This is the piece of the SSO story that matters pre-production; the federation itself waits.

---

## 7. Legal pack — templates only

Draft, as clearly-marked **template documents** (not binding, not legal advice), so they exist when the real deployment and your separate contract need them: an AVV/DPA skeleton (Art. 28 GDPR / nDSG shape), a TOMs document reflecting what SLD actually does (RLS, compartment separation, audit, retention, EU hosting), a sub-processor list stub, and the works-council information pack generator (an extension of the existing worker-briefing). Each carries a visible `TEMPLATE — needs legal review before use` banner. Binding versions are out of scope until the deployment is real.

---

## 8. Deferred (with reason)
- **SSO (SAML/OIDC):** only meaningful when SLD is paired with a real infrastructure landscape; revisit then. MFA (§4) covers the interim.
- **Billing / Stripe / plans:** first customer is on a separate contract within the same company; no in-app billing until there's a second, arms-length customer.
- **Write-mode impersonation:** only if support genuinely needs it.
- **External experimentation platform:** the lightweight flag store (§2.5) is enough for now.

---

## 9. Build order (slices, commit + push after each, tests green)
1. **RLS policies + non-owner role** (§1), behind a flag, proven on staging. Highest value; do first.
2. **Super-Admin console** (§2) in slices: tenant list/create/archive → module-entitlement matrix + default template → catalogue-version activation → audit viewer + user/role overview → demo/pilot hygiene + reset buttons → read-only impersonation → feature flags.
3. **Onboarding wizard** (§3).
4. **MFA + offboarding + logging hygiene** (§4 MFA, §6).
5. **Data portability & deletion** (§5).
6. **Pre-production checklist** (§4 remainder) — propose the list, build what the founder ticks (or highest-value-first if unattended).
7. **Legal-pack templates** (§7).
8. **Verify** each slice end-to-end; update CLAUDE.md status. When P13 lands, the restructure plan's milestone list is complete — summarise what's built and what's deferred (SSO, billing, CH go-live, the per-person exposure register from P8/P10, and any `seed-check` legal rows still awaiting a founder spot-check) for the next phase.

---

## 10. Note on the super-admin role itself
`super_admin` already exists (founder, cross-company, routed to `/admin`) and `l3_support` is reserved beside it. P13 gives `super_admin` its real console; it does not create a new role or widen the data model. Keep the rule that `super_admin` is invite-provisioned and that granting it is itself a super-admin-only, audited action — it is the most powerful account in the system, so its own creation is the one thing that should never be casual.
