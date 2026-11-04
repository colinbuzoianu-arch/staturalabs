# SLD P7b — Resolving the three P7 deferrals

**Approved by:** Colin Buzoianu (founder), 2026-11-04. Delegated research and design by Claude, accepted by the founder.
**Run before P8.** P8 adds substances as a requirement source and uses the retention catalogue, so both must exist first.

Scope: (A) person assignments + requirement derivation, (B) the three new roles with a provisioning/scope surface, (C) the `RetentionRule` catalogue + anonymisation. Engineering rules unchanged: hand-written migrations, enum-only first, RLS on new tables, `Restrict` FKs, append-only histories, `AuditEvent` on every mutation in the people compartment, DE/EN/RO strings, tsc/Biome/Vitest green per commit.

---

## A. PersonAssignment UI + requirement derivation

### A.1 Assignments
- UI in **Personen → Person detail → "Einsatz"** and a bulk view per workstation/org unit. Fields: person, target (workstation **or** org unit, exactly one, CHECK), `validFrom`, nullable `validTo`, note.
- CSV import extension: an optional `workstation`/`orgUnit` column in the people import (dry-run first, as today).
- **Compartment rule (unchanged, now enforced in more places):** assignments are never shown on assessment, ergonomic, risk or environmental screens or documents. Extend the existing schema test so that no assessment-chain model has a relation to `Person` or `PersonAssignment`. Add a test that the hub, workstation risk page and SGD/DE documentation data loaders never query `PersonAssignment`.

### A.2 Requirement sources
A `TrainingRequirementType` becomes required for a person through any of these sources, all at job level:

| Source | Applies to |
|---|---|
| Requirement on a **workstation** | Persons with an active assignment to that workstation |
| Requirement on an **org unit** | Persons assigned to that unit **or any descendant unit, or any workstation in them** (inherits down the tree) |
| Requirement on a **process** | Persons assigned to any workstation that hosts a task of the process |
| `FindingTrainingRequirement` (from P6 §6) | Persons assigned to the workstation of the finding's **current approved** assessment |
| Substance (P8) | Reserved: add the source enum value now, no derivation until P8 |

- One pure function `deriveRequiredTrainings(person, assignments, requirements, asOf)` in `src/lib/training/`, returning `{ requirementTypeId, sources[] }[]`. Every required item carries **why** it is required (source type + id), and the UI shows it ("erforderlich wegen: Arbeitsplatz Presse 3").
- Computed on read, no stored derived table in this version. Unit tests: tree inheritance, validity windows (`asOf`), multiple sources for the same type, ended assignments, archived findings.

### A.3 Matrix
- The instruction matrix shows **required cells only**. Non-required cells show "—". Status per required cell: **gültig** · **fällig in ≤30 Tagen** · **überfällig** · **fehlt**. The 30 days is a company setting, default 30.
- Records without a requirement stay visible as "freiwillig/zusätzlich" in the person detail, not in the matrix.
- Filters: site, org unit, workstation, requirement type, status. Export CSV/XLSX.
- Manager scope (see B): a manager sees only persons in their org units.
- Remove the current "all types × all active persons" placeholder behaviour.

---

## B. The three new roles + provisioning/scope surface

### B.1 Scope model
`RoleAssignment` (`platformUserId`, `role`, `scopeType` ∈ {COMPANY, SITE, ORG_UNIT, SELF}, nullable `scopeId`, `grantedByUserId`, `grantedAt`, nullable `revokedAt`). A CHECK enforces that `scopeId` is null exactly when the scope is COMPANY or SELF. Existing `company_admin`/`site_admin` access is migrated into `RoleAssignment` rows with **no change in effective access**. Prove it with a before/after permission snapshot test over the dev and demo fixtures. `SiteAssignment` stays readable during the transition, then is removed in a follow-up commit.

### B.2 Roles and permissions

| Role | Scope | Can | Cannot |
|---|---|---|---|
| `ehs_specialist` | SITE (one or more) | Assess, inspect, raise and verify actions, manage persons/training/assignments, approve assessments on assigned sites | Settings, users/roles, module entitlement, health compartment (P10) |
| `manager` | ORG_UNIT (one or more, including descendants) | See persons and the instruction matrix for own units, record training sessions and records, see and update actions where they are the responsible user or the action is in their units, read approved assessments | Edit assessments, see persons outside own units, settings |
| `employee` | SELF | See own instruction status and due dates, confirm a received instruction (self-confirmation), report observations (once P9 exists) | See any other person, any assessment detail, any action list |

- The permission constants and bundles from P1 get these three roles as **system role bundles**.
- **Every list and detail query** goes through one scope helper (`src/lib/auth/scope.ts`). No role checks inline in pages.
- `employee` requires `Person.platformUserId` to be set. Linking happens in Personen (company admin or ehs_specialist), and the employee invite is sent from there.
- `occupational_physician` and `works_council` stay deferred to P10 (they need the health compartment and the aggregate views).

### B.3 Provisioning surface
`/app/settings/users`:
- User list with roles and scopes.
- Invite user: email, role, scope picker (sites / org-unit tree / self via person link).
- Change or revoke a role assignment. Revoking keeps history (`revokedAt`), never deletes.
- Disable account (immediate offboarding).

Company admins can grant every role except `super_admin`/`l3_support`. ehs_specialists can invite managers and employees within their sites. Every grant or revoke writes an `AuditEvent`.

### B.4 Verification
A permission matrix test (role × action × in-scope/out-of-scope) and an HTTP walkthrough with one fixture user per role on the AT demo site: the manager sees only own units, the employee sees only themself, and the ehs_specialist can't open settings.

---

## C. RetentionRule catalogue + anonymisation

### C.1 Legal finding (desk research 2026-11-04)
- **No statutory retention period exists for instruction records** in AT or DE. ASchG §14 requires instruction to be carried out *nachweislich* (provably), and ArbSchG §12 / DGUV Vorschrift 1 §4 require instruction and documentation. None of them sets a retention period. DGUV guidance recommends keeping records at least two years, but that is guidance, not law.
- **What matters in practice is proof in a later dispute.** Claims can surface long after an instruction: an accident investigation, or an occupational-disease claim years later, especially for hazardous substances.
- **Accident records are different:** AT ASchG §16 sets a statutory period. That row belongs to P10 (incidents) and is **not** seeded now.
- CH: no specific period identified. The CH pack stays unverified, so CH sites use company policy only.

**Consequence:** for P7 there are **no statutory rows to seed**. Retention for people and training records is **company policy**, with a conservative platform default and a clear "no statutory period" basis shown in the UI.

### C.2 Model
`RetentionRuleCatalogVersion` (single active, fail-closed) + `RetentionRule`:
- `country`, `recordType` enum (`PERSON`, `TRAINING_RECORD`, `TRAINING_SESSION`, `PERSON_ASSIGNMENT`; later `INCIDENT_*`, `SDS`, …)
- `basis` enum: `STATUTORY` | `NO_STATUTORY_PERIOD` | `POLICY_DEFAULT`
- `minRetention` (ISO 8601 duration or null), `trigger` enum (`END_OF_EMPLOYMENT`, `RECORD_DATE`, `SUPERSEDED`)
- `sourceUrl`, `consolidatedVersion`, `verifiedAt`, `verifiedBy`, `verificationMethod` (required when `basis = STATUTORY`)
- A CHECK: `STATUTORY` rows must have `minRetention` and `sourceUrl`.

`CompanyRetentionSetting` (`companyId`, `recordType`, `retention`, `trigger`, `setByUserId`, `setAt`). It can be longer than any statutory minimum, never shorter (validated in the lib gate). Optional per-`TrainingRequirementType` override (P8 will use it for substance instructions).

### C.3 Seed (catalogue `v1-2026-11`)

| country | recordType | basis | minRetention | Note shown in UI |
|---|---|---|---|---|
| AT | TRAINING_RECORD | NO_STATUTORY_PERIOD | — | Nachweispflicht nach § 14 ASchG, keine gesetzliche Aufbewahrungsfrist. Frist nach Unternehmensrichtlinie. |
| DE | TRAINING_RECORD | NO_STATUTORY_PERIOD | — | Dokumentationspflicht (§ 12 ArbSchG, DGUV Vorschrift 1 § 4), keine gesetzliche Aufbewahrungsfrist. Frist nach Unternehmensrichtlinie. |
| AT, DE | PERSON, PERSON_ASSIGNMENT, TRAINING_SESSION | NO_STATUTORY_PERIOD | — | Keine gesetzliche Frist; folgt den verknüpften Nachweisen. |

Source URLs: the verified ASchG §14 and ArbSchG §12 rows from P3 (reuse the same `sourceUrl`/`consolidatedVersion`). `verificationMethod = mirror` for AT and `official` for DE, `verifiedBy = Colin Buzoianu`, `verifiedAt = 2026-11-04`.

**Platform default company policy** (pre-filled for every company, editable by company_admin; changes take effect for future runs only):
- TRAINING_RECORD: **10 years after end of employment.** Rationale shown in the settings UI: long enough to cover typical later claims and investigations; companies with long-latency hazards (e.g. carcinogens) should set longer per requirement type.
- PERSON / PERSON_ASSIGNMENT / TRAINING_SESSION attendee link: retained as long as any linked training record is retained, then anonymised.
- Persons with **no** linked records: 1 year after end of employment.

### C.4 Anonymisation job
- **Daily job computes candidates.** It never deletes or anonymises on its own the first time a candidate appears. It writes a **proposal batch** visible in `/app/settings/retention` (counts per record type, list of persons, reason, date the rule matured).
- **A company_admin approves a batch** (human review, same principle as §3.4). After the first approved batch, the admin can switch the company to "automatisch ausführen". The setting is off by default, can be revoked, and is logged.
- **Legal hold:** a `legalHold` flag on Person (with reason and who set it) excludes the person and all linked records from every batch until it is cleared.
- **Anonymisation** (not deletion):
  - Person name → `Anonymisiert-<short hash>`, personnel number → null, `platformUserId` link → null (the account is disabled separately).
  - Free-text notes on that person's records → cleared.
  - Training records and session attendance stay as anonymous rows, so aggregate statistics (instruction coverage by year) still work.
  - Assignments are deleted after the person is anonymised. They carry no value once the person is anonymous.
- Every run, proposal, approval and anonymised record writes an `AuditEvent`. The audit event stores the record id, never the removed name.
- Data-subject access export (P7) and anonymisation must agree: an anonymised person can no longer be exported by name.

### C.5 Verification
- Unit tests: rule resolution (company setting vs. catalogue, never shorter than statutory), trigger dates, legal hold exclusion, idempotent re-runs.
- Integration test on the dev fixture: a person with an end date 11 years ago is proposed. After approval they are anonymised, the matrix and coverage numbers are unchanged, and the audit trail is complete.
- A schema test that `RetentionRule` rows with `basis = STATUTORY` can't be inserted without `minRetention`/`sourceUrl`.

---

## D. Order and handover
1. **B.1–B.2 first** (scope model and roles), because A.3's manager view and C.4's approvals depend on it.
2. Then **A**, then **C**.
3. Update CLAUDE.md "Status" and remove the three items from the P7 deferral list.
4. Then start **P8** per `SLD_RESTRUCTURE_PLAN_platform-modules.md`, using:
   - the reserved `SUBSTANCE` requirement source (A.2),
   - the per-requirement-type retention override (C.2),
   - new `RetentionRule` record types for SDS and substance use, drafted with source links for review like P3.
