# SLD P7 — Personen + Unterweisungen: compartment design note (for founder review)

**Status: DESIGN NOTE — awaiting founder sign-off. No schema, migration or code yet.**

Per `SLD_RESTRUCTURE_PLAN_platform-modules.md` §11 ("For P7 and P10, start with a short design note on the compartment boundary — tables, permissions, audit, retention, the schema test from §3.1 — before code"). This is the first live introduction of **person data** into the product, so the boundary is settled here before anything is built.

---

## 1. Scope

**In P7:** the `people` register (`Person`, `PersonAssignment`) and `training`/Unterweisungen (`TrainingRequirementType`, `TrainingSession`, `TrainingRecord`, the instruction matrix), per plan §7.6/§7.7 and §3.2.

**Not in P7 (explicit):** health sub-compartment and incidents (P10); `Gefahrstoffe`/`Substance` (P8) — so a training requirement *derived from a substance* is wired in P8, and P7 ships the workstation/process/finding/org-unit derivation only. No medical data of any kind enters in P7.

---

## 2. The compartment boundary (the hard rules, from §3.1 / ERGO §3.18)

1. **No FK from any assessment-chain table into the people compartment, ever.** The link only ever points *outward* from people → (workstation/org-unit/finding) as a requirement *source*, never finding → person. The assessment chain stays byte-for-byte person-free.
2. **No view or report joins the two.** Instruction coverage is computed inside the people compartment and only ever surfaced as an aggregate (§3.4), never joined onto a risk/ergonomic screen or document.
3. **`PlatformUser` ≠ `Person`.** Separate tables; `Person.platformUserId` is an *optional, one-way* link for self-service only (an employee seeing their own instruction status).
4. **`PersonAssignment` exists only to derive instruction requirements.** Never shown on an assessment screen, never in a risk report; the only analytics on it is "instruction coverage".
5. **Schema tripwire** (`src/lib/compartment-schema.test.ts`) already lists `Person`, `PersonAssignment`, `TrainingRecord`, `TrainingSession` in `FORBIDDEN_PERSON_MODELS` — so the instant any of them is added, the guard checks no assessment-chain model references them. P7 keeps that green and **adds a second assertion**: the new person-compartment tables must not FK *into* the assessment chain either (the guard today only checks the reverse direction). See §7.
6. **Minimum group size** (§3.4, default 5) enforced in one query helper for every person-derived statistic.

---

## 3. Proposed schema (people compartment)

All new tables: RLS on, enum-first migration where an enum is touched, FKs `Restrict` (§3.9). None of them reference any assessment-chain model.

### `Person` (§3.2 — deliberately minimal)
| field | type | note |
|---|---|---|
| `id` | cuid | |
| `companyId` | FK Company | tenant scope |
| `firstName`, `lastName` | String | |
| `personnelNumber` | String? | optional |
| `orgUnitId` | FK OrgUnit? | the person's home org unit |
| `employmentStart`, `employmentEnd` | DateTime? | |
| `active` | Boolean @default(true) | |
| `platformUserId` | `@db.Uuid`? | **plain column, not an FK** (same discipline as `Action.responsibleUserId`) — optional self-service link |
| `anonymisedAt` | DateTime? | set by the anonymisation workflow |

**Explicitly excluded** (ERGO §3.18 never-build): date of birth, address, nationality, gender, health data, performance data, any HR field not listed. A schema comment enumerates this.

### `PersonAssignment`
`personId` FK, exactly one of (`workstationId` | `orgUnitId`) via a hand-added CHECK, `validFrom`/`validUntil`. Used **only** to derive instruction requirements.

### `TrainingRequirementType` (the catalogue of instruction types)
`companyId` (null = system), `title`, `contentOutline` String?, `recurrenceMonths` Int?, `legalReferenceId` FK→`LegalReference`? (reuse the P3 catalogue — country-scoped, no new legal content), `deliveryMethod` enum (`IN_PERSON` | `ELEARNING` | `DOCUMENT_READ_CONFIRMATION`).

### Requirement sources (how a requirement attaches)
`TrainingRequirementSource`: a `TrainingRequirementType` + exactly one of `workstationId` | `processId` | `riskFindingId` | `orgUnitId` (CHECK). **This is the one subtle point:** these columns point *from* the training compartment *to* assessment-chain tables (workstation/process/finding). That's the allowed direction (people→job), but it means `TrainingRequirementSource` is a people-compartment table holding assessment-chain FKs. 
→ **Decision needed (D1):** allow these FKs (they're the mechanism §7.6 describes: "requirements derived from workstation, process, finding, org unit"), but the compartment test must treat `TrainingRequirementSource` as people-side and assert the assessment-chain tables never gain a reverse relation. I recommend **allow**, with the test asserting direction. Alternatively, store the source as a loose `subjectType`+`subjectId` pair (no FK), keeping zero schema-level coupling — slightly weaker integrity, zero coupling. **My recommendation: loose `subjectType`+`subjectId` (no FK)** — it keeps the compartment physically FK-free in both directions, matching how `AuditEvent`/`Notification` already avoid cross-cutting FKs, and the subject helper already validates subject existence.

### `TrainingSession`
`companyId`, `requirementTypeId` FK, `date`, `instructor` String (free text — the instructor is not necessarily a Person), `topics` String?, `notes` String?.

### `TrainingRecord` (the proof)
`personId` FK, `requirementTypeId` FK, `trainingSessionId` FK?, `completedAt`, `method` enum, `confirmation` enum (`SIGNATURE` | `SELF_CONFIRMED`), `validUntil` DateTime?. This is the row that proves "this person was instructed on this, on this date, valid until".

---

## 4. Roles & permissions

The permission vocabulary already has `people.read/write` and `training.read/write` (added in P1, granted to no one yet). P7 needs real holders:

- **`company_admin` / `site_admin`:** grant `people.*` and `training.*` (scoped as today).
- **Three new `PlatformRole` values** are needed for P7's actors: `EHS_SPECIALIST`, `MANAGER`, `EMPLOYEE` (§3.3). `OCCUPATIONAL_PHYSICIAN` and `WORKS_COUNCIL` are health-/aggregate-facing and more naturally land with **P10** (incidents/health) — adding them in P7 would mean role values with no reachable surface yet.
  → **Decision needed (D2):** add **three** roles now (my recommendation) vs. all five.
- New roles require an **enum-first migration** (`PlatformRole` additions) + extending `ROLE_PERMISSIONS` in `permissions.ts`. Grants:
  - `EHS_SPECIALIST`: `training.*`, `people.read`, plus the assess/inspect set it already needs.
  - `MANAGER`: `training.read` (+ confirm for own org units), `people.read` limited — **scope**: own org units only. Current scoping (`rbac.ts`) is site-based; org-unit-level scoping for `manager` is **new** and is its own sub-decision (D3): P7 can ship `manager` at site scope first and tighten to org-unit scope in a follow-up, or build org-unit scope now.
  - `EMPLOYEE`: `training.read` for **their own** records only (via `Person.platformUserId`), confirm own instruction. Self-scope is also new.
  → **Decision needed (D3):** org-unit / self scope for `manager`/`employee` now, or ship at site scope and refine later. **My recommendation: ship `people`/`training` for admins + `ehs_specialist` at site scope in P7a; add `manager`/`employee` with their narrower scopes in P7b** so the scope model gets its own focused change.

Health (`health_data.*`) stays granted to no one in P7 (no health data exists until P10).

---

## 5. Audit (ERGO §3.18(d))

Every people-compartment mutation goes through `recordAuditEvent` (the existing helper): `person.create` / `person.update` / `person.anonymise` / `person.import`, `training_record.create` / `training_record.confirm`, `training_requirement.create`. `actorUserId` = the acting PlatformUser; `entityType`/`entityId` the row; diff limited to non-sensitive fields. (Health-read auditing is P10.)

---

## 6. Retention & anonymisation (§3.2, §4)

§3.2: "deactivated persons are anonymised after the longest applicable retention period for their linked records (catalogue per country, §4)." Two parts:

- **The workflow** (build in P7): deactivate a person (`active=false`), and an **anonymise** action that nullifies name/personnel number (keeping `TrainingRecord` rows for proof, but de-identified — the record of *that an instruction happened* survives, the *who* is scrubbed), sets `anonymisedAt`, writes an audit event. Also a **DSAR export** (§7.7): one person's records across the compartment as JSON.
- **The legal retention periods** (gated): the *when* — how long each record type must be kept per country — is legal content. Per the §11 discipline it needs a **founder-verified retention catalogue** (country-scoped, like legal refs / exposure limits), which does not exist yet.
  → **Decision needed (D4):** P7 ships the manual deactivate/anonymise/export workflow + an `anonymisedAt` field now; the **automatic** retention-driven anonymisation + the legal periods come later via a verified `RetentionRule` catalogue (I'd draft it for your sign-off then, same gate as P3/P6). **My recommendation: manual workflow now, auto-retention catalogue as a later gated step.**

---

## 7. The schema test (§3.1 tripwire) — what P7 changes

- Keep the existing assertion (assessment-chain → people-compartment forbidden); it stays green because no assessment-chain table gains a person relation.
- **Add the reverse assertion:** a list of people-compartment models (`Person`, `PersonAssignment`, `TrainingRecord`, `TrainingSession`, `TrainingRequirementType`, `TrainingRequirementSource`) must not declare an `@relation` whose *type* is an assessment-chain model. This is why §3's D1 recommends the loose `subjectType`+`subjectId` for requirement sources — it keeps this assertion absolute rather than carved-out.
- Add a test that the min-group-size helper is the only path person-derived aggregates take (a lint-style check that `TrainingRecord`/`PersonAssignment` counts in UI code go through the helper).

---

## 8. Analytics (§3.4)

One helper `withMinimumGroupSize(count, groupSize = 5)` → returns the count or a "suppressed (n<5)" sentinel. Instruction-coverage aggregates (by site / org unit / requirement type / quarter) run through it. No per-person ranking, no weekday×org-unit or shift×person slicing.

---

## 9. What I need from you (decisions)

- **D1** — requirement-source link: loose `subjectType`+`subjectId` (my rec, zero FK coupling) vs. real FKs with a direction-aware test.
- **D2** — add **3** new roles now (`EHS_SPECIALIST`, `MANAGER`, `EMPLOYEE`) vs. all 5.
- **D3** — `manager`/`employee` scope: ship at site scope in P7b (my rec) vs. build org-unit/self scope now.
- **D4** — retention: manual anonymise/export workflow now + gated `RetentionRule` catalogue later (my rec) vs. build retention periods now (needs your legal verification first).
- Confirm the **`Person` field set** (§3) is exactly right — nothing added, nothing missing for AT/DE statutory instruction proof.

On your decisions I'll build in slices (P7a people register + CSV import + the schema-test extension; P7b training requirements + records + instruction matrix + the new roles), each `tsc`/Biome/Vitest green, migrations applied live, HTTP-verified, demo fixture updated — then P8.
