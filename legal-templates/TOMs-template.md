# Technical and organisational measures (TOMs) — template

> **TEMPLATE — needs legal review before use. Not binding, not legal advice.**
> Art. 32 GDPR / Art. 8 nDSG. Operating entity: Verumsell SRL. Prepared for a
> Data Protection Officer / counsel to review and adapt before use with a
> customer or regulator.

This document describes the technical and organisational measures the Statura
Labs Dynamics platform implements to protect personal data. Unlike the other
files in this pack, the measures below are **factual descriptions of the
system as built**, not placeholders — but they still require legal review for
completeness and wording, and a few items (marked *staging*) are built but not
yet armed in production.

## 1. Data-minimisation and compartment separation (privacy by design)
- The **assessment chain is person-free by construction**: workstation → task →
  posture/zone sample → body-region score, risk assessments, environmental
  assessments and exposure measurements never reference a person. This is
  enforced by a schema test (`compartment-schema.test.ts`), both directions.
- Person data lives **only** in a separate people compartment (people, training,
  incident involvement), each row tied to a named statutory duty, with **no
  foreign key** crossing into the assessment chain and no view/report joining
  the two.
- Login accounts (`PlatformUser`) are distinct from employee records (`Person`);
  the link is optional and one-way.
- Person-derived statistics pass a **minimum group-size gate** (default 5) so no
  figure can single out an individual.

## 2. Special-category (health) data
- Health data exists only inside the incidents sub-compartment, behind dedicated
  `health_data.read` / `health_data.write` permissions held by the occupational
  physician role only.
- Free-text medical fields are **encrypted at rest with AES-256-GCM**; the coarse
  injury classification used for statutory data sheets and KPIs is stored
  separately and never includes the encrypted narrative.
- **Every decryption writes an audit event before the plaintext is returned.**
- Health free-text is never exported, never logged, and never placed in a
  generated document.

## 3. Access control and authentication
- Role-based access with fail-closed scope checks (company / site); a missing or
  inaccessible resource returns 404 rather than confirming its existence.
- **Row-Level Security** policies on every table, scoping each tenant to its own
  company, with a non-owning application role. *(Staging: policies are in place
  and proven; the runtime role switch is armed on the staging rollout —
  `SLD_P13_RLS_ROLLOUT.md`.)*
- **Multi-factor authentication (TOTP)** for high-privilege and health roles.
  *(Staging: built, flag-gated — `SLD_P13_MFA_ROLLOUT.md`.)*
- Accounts are invite-provisioned (no public sign-up); granting the super-admin
  role is itself an audited, super-admin-only action.
- Account disable is immediate and complete (app-layer block on every request
  plus a best-effort auth-provider ban), with role history retained.

## 4. Auditability
- A global, append-only `AuditEvent` records every mutation in regulated modules
  (actor, action, entity, tenant, hashed IP), with no foreign keys so it
  outlives the entities it describes. Read-only admin impersonation is itself
  banner-marked and audited, and blocks all mutations.

## 5. Retention and erasure
- Retention is data, not code: versioned retention catalogues drive per-record
  retention, per country, with no cross-country borrowing.
- Deletion candidates are proposed and approved through dedicated batch flows
  (person anonymisation, substance retention, incident retention), each separate
  and each hard-deleting only on approval, legal-hold-suppressed.
- Contract-end tenant deletion is a deliberate, double-confirmed, audited
  super-admin action that hard-deletes a company's data leaf-to-root while
  preserving shared catalogues and the audit trail.

## 6. Hosting, transport and storage
- Hosted in the EU (Supabase, eu-west-1). *(Confirm the exact region and the
  processor chain for the real deployment; see `subprocessors-template.md`.)*
- TLS in transit; security headers on every response (HSTS, nosniff, frame
  denial, a restrictive permissions policy, a content-security policy).
- **No camera or video capture anywhere in the product** (removed for GDPR,
  Oct 2026): no image, frame or footage is captured, transmitted or stored.

## 7. Software development and operations
- Dependency vulnerability scanning in CI (build fails on a high/critical
  production advisory); typecheck, lint and an automated test suite gate every
  change.
- Structured logging that carries tenant/entity ids and event types only — never
  a worker name or health detail (guarded by an automated test).
- A health endpoint (`/healthz`) and a provider-agnostic error-monitoring seam.

---

*Items marked “staging” are implemented in code and flag-gated; arming them in
production is a documented deployment step. Review this whole document against
the live deployment’s actual configuration before relying on it.*
