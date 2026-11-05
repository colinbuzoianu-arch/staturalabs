# SLD P10 — Ereignisse (incidents) incl. health sub-compartment: compartment design note (for founder review)

**Status: DESIGN NOTE — awaiting founder sign-off. No schema, migration or code yet.**

Per `SLD_RESTRUCTURE_PLAN_platform-modules.md` §11 ("For P7 and P10, start with a short design note on the compartment boundary — tables, permissions, audit, retention, the schema test from §3.1 — before code") and §9's standing rule that **every legal reference, deadline, retention period or limit is drafted with official source links and stops for founder verification before seeding or UI text**. P10 introduces the single most sensitive thing in the product — **health data** — so the boundary, the encryption approach, the audit rule and the legal catalogue are settled here before anything is built.

The legal content (statutory notification deadlines, accident-record and health-data retention periods) is drafted separately in **`SLD_P10_STATUTORY_NOTIFICATIONS_DRAFT.md`** with official source links, for your verification. Nothing in that draft is seeded until you return it approved.

---

## 1. Scope

**In P10** (plan §7.4): the `incidents` module — event reporting, triage, investigation (structured cause analysis), actions (via the one action engine), closure, and the assessment-review flag; the **health sub-compartment** (injury/illness detail, encrypted, physician-only, every read audited); **statutory notification support** (deadline clock from a founder-verified catalogue, a pre-filled print view, a "submitted on / reference number" record — no direct submission to authorities in v1); the **first-aid book** (Verbandbuch equivalent) as an event type with its own retention; and environmental-event flagging into the environment domain **without mixing artifacts**.

**Not in P10 (explicit):**
- **No direct electronic submission** to AUVA / DGUV / Suva portals (ELDA, the BG extranet, sunet/KLE). v1 produces a print/data sheet and records that a human submitted it. Direct integration is a later, per-country decision.
- **The per-person chemical exposure registers** (DE §10a GefStoffV, AT §47 GKV-equivalent, CH) that P8 reserved (`RetentionRecordType.SUBSTANCE_EXPOSURE_KM` / `_R`) — see **D7**. Structure stays reserved; the surface is built only once a chemical-exposure-measurement capture path exists, and its retention rows are gated legal content regardless.
- **Anonymous QR reporting** — see **D5** (recommend: logged-in + manual report now, anonymous channel as a scoped follow-up with its own abuse controls).
- **Notification-service wiring** (incident-reported alert, deadline-approaching alert) — the records and the deadline field land in P10; the *push* rides the P5 notification service's `NotificationRule` events ("incident reported", "notification deadline approaching") and is wired as a thin follow-up, not rebuilt here.

---

## 2. The compartment boundary (the hard rules, §3.1 / ERGO §3.18)

P10 is where **health data** first exists, and where person data first attaches to an *event* rather than a training proof. The rules P7 established hold unchanged, plus two new ones for health:

1. **No FK from any assessment-chain table into the incidents/health compartment, ever.** An incident may *name* a workstation, org unit or site it happened at — but as **plain columns** (`subjectWorkstationId`, `subjectOrgUnitId`), validated through the subject helper, **never a relation** — exactly as `Inspection` already does. The assessment chain stays byte-for-byte person-free, and the compartment never FKs into it. (This is why the assessment-review flag in §5 is a one-way, human-confirmed signal, not a join.)
2. **No view or report joins a person to a score, finding or assessment.** Incident counts surface as aggregates only (§3.4 min-group-size), never joined onto a risk/ergonomic screen or document.
3. **Health is a sub-compartment inside incidents** — separate tables (`IncidentHealthDetail`), a separate permission pair (`health_data.read` / `health_data.write`), field-level encryption at rest for free-text medical fields, and **every read logged in `AuditEvent`** (the one place in the whole product where a *read*, not just a write, is audited — ERGO §3.18(c)).
4. **`PlatformUser` ≠ `Person`, still.** The reporter, triager, investigator and submitter of an incident are `PlatformUser` ids (plain `@db.Uuid`, no FK — as `Action.responsibleUserId` / inspection team already are). The *injured/involved* people are `Person` references (people-compartment → people-compartment FK, allowed). The two never mix: a `PlatformUser` is who operated the system, a `Person` is who was involved.
5. **Health data is withheld from every role by default** and granted only to a new `OCCUPATIONAL_PHYSICIAN` role (§3.18(b)). An incident can be recorded, investigated, actioned and closed, and a statutory notification prepared, **entirely without `health_data.*`** — the coarse, non-free-text injury classification an admin needs for the notification data sheet (injury type, affected body region, incapacity days) is the line between "what the notification form legally needs" and "the medical record", and it sits deliberately on the *non-health* side (see D2). Free-text diagnosis / treatment / medical history is health-only.

---

## 3. Proposed schema (incidents + health sub-compartment)

All new tables: RLS on, enum-first migration where an enum is touched, FKs `Restrict` (§3.9) except composed children of an `Incident` which may `Cascade` to their parent incident only (same call as inspection sections/answers). None reference any assessment-chain model.

### Event types — `IncidentType` enum (D1)
The plan calls event types "a catalogue". They are a **fixed, non-legal vocabulary** (the *deadlines* attached to them are the legal content, and those live in the gated catalogue, §6). I propose an **enum**, not a table — same treatment as `HazardCategory` / `EnvironmentalAspectCategory`:
`ARBEITSUNFALL`, `WEGEUNFALL`, `BERUFSKRANKHEIT_VERDACHT`, `BEINAHEUNFALL`, `ERSTE_HILFE`, `BRAND`, `SACHSCHADEN`, `UMWELTEREIGNIS`, `FAHRZEUGEREIGNIS`, `SECURITY_VORFALL`, `GEWALT_UEBERGRIFF`, `BEHOERDE_BEANSTANDUNG`, `SONSTIGES`.
Labels are hand-authored DE/EN/RO presentation copy (like `hazardCategoryLabels`), not legal text.

### `Incident` (the case record — person-free in itself)
| field | type | note |
|---|---|---|
| `id` | cuid | |
| `companyId`, `siteId` | FK Company / Site | tenant scope (Site FK is fine — Site is not people- or assessment-chain-forbidden; it is the tenant root) |
| `type` | `IncidentType` | |
| `status` | `IncidentStatus` | `REPORTED → TRIAGED → UNDER_INVESTIGATION → ACTIONS_PENDING → CLOSED`; one revert (`CLOSED → ACTIONS_PENDING`), gated like every other status gate |
| `severity` | `RiskBand?` | reuse the one risk vocabulary (as inspection observations do); nullable until triage |
| `occurredAt` | DateTime | |
| `reportedAt` | DateTime @default(now()) | |
| `reportedByUserId` | `@db.Uuid?` | null = anonymous channel (D5, deferred) |
| `subjectWorkstationId`, `subjectOrgUnitId` | String? | **plain columns, no relation** (subject helper validates); where it happened |
| `locationText` | String? | free-text location fallback |
| `title`, `description` | String | what happened — person-free narrative (names of involved people live in `IncidentInvolvedPerson`, never in the free text; the UI says so) |
| `isWorkRelated` | Boolean? | triage output; drives notification applicability |
| `environmentalEventFlagged` | Boolean @default(false) | §7.4 "environmental events also flag records in the environment domain **without mixing artifacts**" — a one-way flag, resolved by a human into an `EnvironmentalFinding` in the env domain, never an FK join |
| `assessmentReviewFlagged` | Boolean @default(false) | §6/§7.4 "assessment review flag" — a one-way signal that the workstation's assessment may need review; surfaced in the hub as "Überprüfung erforderlich", **not** a join from incident to assessment |
| `closedAt`, `closedByUserId` | DateTime? / Uuid? | |
| `createdAt`, `updatedAt` | | |

### `IncidentInvestigation` (1:1 with Incident — structured cause analysis, person-free)
`incidentId` unique FK, `sequenceOfEvents` String?, `directCauses` String?, `rootCauses` String?, `contributingFactors` String?, `method` enum (`FIVE_WHY` | `ISHIKAWA` | `NARRATIVE`), `investigatedByUserId` `@db.Uuid?`, `investigatedAt` DateTime?. Structured fields, not a free-form blob (§7.4 "5-Why / Ishikawa as structured fields"). Person-free — describes the event, not a person.

### `IncidentInvolvedPerson` (people-compartment)
`incidentId` FK, `personId` FK → `Person` (people→people, allowed), `role` enum (`INJURED` | `WITNESS` | `FIRST_AIDER` | `OTHER`). This is the only place a `Person` attaches to an incident. No health data here — it is the *link*, not the medical record.

### `IncidentHealthDetail` (the health sub-compartment — encrypted, physician-only)
`id`, `incidentInvolvedPersonId` unique FK (1:1 with the injured involved-person row; both people-side), plus:
- **Coarse structured, plaintext** (what the statutory data sheet legally needs, and the only thing KPIs read, always through the min-group-size helper): `injuryType` enum (a GDA/ESAW-style coarse list — bone fracture, wound/laceration, burn, etc., hand-authored, **not** a legal code table), `bodyRegion` enum (coarse — head, torso, arm, hand, leg, foot, …), `incapacityDays` Int?, `fatal` Boolean, `medicalTreatmentGiven` Boolean. **D2.**
- **Free-text medical, ENCRYPTED at rest** (health-only, physician-written): `diagnosisEnc`, `treatmentNotesEnc`, `medicalHistoryNoteEnc` — ciphertext columns (`String?`), never queried, never aggregated, never in a diff, never in a print view that is not itself physician-gated. **D3** covers the key.

`IncidentHealthDetail` is **read only with `health_data.read` and a `recordAuditEvent` for that read**, and written only with `health_data.write`. It holds no assessment-chain FK and no `PlatformUser` FK.

### `StatutoryNotification` (case-compartment — the notification record, person-free)
`id`, `incidentId` FK, `country` `CountryCode`, `notificationRuleId` FK → `IncidentNotificationRule?` (the gated catalogue row that set the deadline; null when prepared manually), `status` enum (`NOT_REQUIRED` | `REQUIRED` | `SUBMITTED` | `WAIVED`), `deadlineAt` DateTime? (computed from the catalogue clock at creation — *pinned*, like every other versioned-catalogue consumer, never recomputed against "whatever is active now"), `submittedAt` DateTime?, `referenceNumber` String?, `submittedByUserId` `@db.Uuid?`. No health fields; the pre-filled data sheet pulls coarse structured injury fields (non-health side) + the person's name from `IncidentInvolvedPerson`, and is generated per the §6 country gate.

### First-aid book (Verbandbuch)
**Not a new table** — an `Incident` of `type = ERSTE_HILFE`. The Verbandbuch is a filtered list + a print view over those rows, with its **own retention record type** (`FIRST_AID_RECORD`, §6) because its statutory retention differs from a reportable accident. Keeping it as an incident type (not a parallel table) means one case model, one audit trail, one action engine.

### Action engine (one-of-five)
`Action` gains `incidentId String?` + relation; the exactly-one-source CHECK widens from one-of-four to **one-of-five** (riskFinding / assessmentSession / environmentalFinding / inspectionObservation / **incident**), a drop-and-re-add hand-written migration exactly as E1 and P9 did. An incident's corrective/preventive actions are raised through `transitionAction()` like every other source — no second action table.

---

## 4. Roles & permissions

The vocabulary already has `incidents.read/write` and `health_data.read/write` (P1), granted today only to admins (minus health) and `incidents.read` to `EHS_SPECIALIST`. P10 adds the **two remaining §3.3 roles** (enum-first `PlatformRole` migration), closing the §3.3 table:

- **`OCCUPATIONAL_PHYSICIAN`** — the **only** holder of `health_data.read` / `health_data.write`. Bundle: `health_data.*`, `incidents.read`, `my-tasks.read`, `cockpit.read` (aggregate only). No `risk.write`, no `people.write`. Scope: company or assigned sites via the existing `RoleAssignment` model. **D4.**
- **`WORKS_COUNCIL`** — read-only co-determination surface: `incidents.read` (no health), `reports.read`, `cockpit.read`, `risk.read`. Mirrors the §193 Abs. 5 SGB VII works-council co-signature on the Unfallanzeige and the general co-determination read access. **No `health_data.*`, no write anywhere.** **D4.**

Grant changes to existing roles:
- `EHS_SPECIALIST`: add `incidents.write` (they record and investigate incidents). Still no `health_data.*`.
- `COMPANY_ADMIN` / `SITE_ADMIN`: already have `incidents.write` via `ALL_EXCEPT_HEALTH`; unchanged. Still no `health_data.*` — an admin can run the whole incident case and prepare the notification, but cannot read the medical free-text. This is the §3.18(b) line and it is deliberate: health is the physician's, not the administrator's.
- `MANAGER`: add `incidents.read` + a narrow `incidents.write` for *reporting* within own org units (D4 sub-point — reuse the P7b org-unit scope, don't invent new scope).

`health_data.*` is **never** added to `ALL_EXCEPT_HEALTH`; that filter is the structural guarantee it stays physician-only.

---

## 5. Audit (ERGO §3.18(c)/(d)) — including the read rule

Every incidents mutation goes through `recordAuditEvent` (existing helper): `incident.create` / `incident.triage` / `incident.status` / `incident.close`, `incident_investigation.update`, `statutory_notification.prepare` / `.submit`, `involved_person.add`.

**The new rule P10 introduces: a read of the health sub-compartment is audited.** Every load of `IncidentHealthDetail` (decrypting any `*Enc` field) writes `recordAuditEvent({ action: "health_data.read", entityType: "IncidentHealthDetail", entityId, actorUserId, companyId })` **before** returning plaintext. This is enforced in one gate (`readIncidentHealthDetail()` in `src/lib/incidents/health.ts`) that is the *only* path that decrypts — no component, route or report decrypts inline. The diff on any health write records **that** fields changed, never their values (§3.18: "never raw health free-text, which stays in the encrypted sub-compartment and is referenced, not copied").

---

## 6. Statutory notification & retention — the gated legal catalogue

Two kinds of legal content, both drafted in `SLD_P10_STATUTORY_NOTIFICATIONS_DRAFT.md` for your verification, neither seeded until approved:

**(a) The notification deadline catalogue** — a new versioned, single-active `IncidentNotificationCatalogVersion` + `IncidentNotificationRule` (country + incidentType → deadline ISO-8601 duration + threshold text + `legalReferenceId` into the P3 `LegalReference` catalogue + the same `verifiedBy`/`verifiedAt`/`verificationMethod`/`sourceUrl` provenance every other catalogue carries). The deadline clock on a `StatutoryNotification` is computed from the active rule at creation and pinned. Fail-closed per §3.15: a country with no rule for a type shows an honest "no notification rule on file for this country" — **never** borrows another country's deadline. The draft covers AT (§363 ASVG, 5 days, >3-day incapacity or death), DE (§193 SGB VII, 3 days, >3-day incapacity or death; Verbandbuch for the rest), CH (UVG/VUV — Suva's official wording is "so rasch wie möglich"; the commonly-cited 3-calendar-day figure is from secondary sources and is flagged for your UVG/VUV check).

**(b) Retention periods** — new `RetentionRecordType` values `INCIDENT`, `INCIDENT_HEALTH`, `FIRST_AID_RECORD` (enum-first migration), with per-country `RetentionRule` rows under a new catalogue version. The periods (how long an accident record, a health record, a Verbandbuch entry must be kept per country) are legal content, drafted with sources, gated. The **deletion mechanics** (a `RetentionBatch`-style proposal that respects `Person.legalHold` and never co-approves with person anonymisation — the P7d/P8 discipline) are built structurally in P10; the *periods* arrive only once you approve them.

---

## 7. Encryption of health free-text (D3)

- **Mechanism:** application-level **AES-256-GCM** (`node:crypto`), one `src/lib/incidents/health-crypto.ts` with `encryptHealthField` / `decryptHealthField` (random 96-bit IV per field, authentication tag stored with the ciphertext, versioned key id prefix so a future rotation can tell key generations apart). Ciphertext stored base64 in the `*Enc` columns. No plaintext medical free-text ever touches disk, a log, a diff, or a non-physician-gated response.
- **Key:** from `HEALTH_DATA_ENCRYPTION_KEY` (env, 32 bytes, EU-hosted secret) in P10. **Production key management — KMS-backed storage, rotation, per-tenant keys — is a P13 hardening item**, called out there, not faked here. The key-id prefix is the seam that makes rotation possible later without re-reading this note.
- **Decision D2** fixes *what* is encrypted: free-text (`diagnosis`, `treatmentNotes`, `medicalHistoryNote`) encrypted; coarse structured (`injuryType`, `bodyRegion`, `incapacityDays`, `fatal`, `medicalTreatmentGiven`) plaintext, because (i) the statutory data sheet needs them, (ii) they are the ESAW/GDA accident-statistics fields the §7.10 KPIs compute (lost days, body-part distribution) — always through the min-group-size helper — and (iii) they carry no diagnosis detail. If you want the whole health row encrypted (no plaintext structured fields, KPIs lose body-part/lost-day granularity), say so — that is the main open call in this note.

---

## 8. The schema test (§3.1 tripwire) — what P10 changes

`src/lib/compartment-schema.test.ts` already lists `Incident`, `IncidentHealthDetail`, `IncidentInvolvedPerson`, `HealthRecord` in `FORBIDDEN_PERSON_MODELS`. P10:
- Adds `IncidentInvestigation`, `StatutoryNotification` to the people-compartment list (and drops the unused placeholder `HealthRecord` in favour of the real `IncidentHealthDetail`, or keeps `HealthRecord` reserved — minor, noted).
- Keeps both existing assertions green: no assessment-chain model references any of them (forward), and none of them reference an assessment-chain model (reverse) — which is exactly why `Incident.subjectWorkstationId` / `subjectOrgUnitId` are **plain columns, no `@relation`**, mirroring `Inspection`.
- Adds a third assertion specific to health: **`IncidentHealthDetail` declares no `@relation` to `PlatformUser` and no plaintext field name matching `/diagnosis|treatment|medical/` without an `Enc` suffix** — a lint-style guard that the free-text medical fields are the encrypted ones, so a future edit can't add a plaintext `diagnosis String` and slip past review.
- Extends the min-group-size lint (P7 §7) to incident counts: any `incident`/`incidentHealthDetail` aggregate in UI code must go through `withMinimumGroupSize`.

---

## 9. What I need from you (decisions)

- **D1** — event types as a fixed `IncidentType` **enum** (my rec) vs. a catalogue table.
- **D2** — health encryption granularity: **free-text encrypted + coarse structured plaintext for the data sheet & KPIs** (my rec) vs. encrypt the whole health row (KPIs lose body-part/lost-day granularity). *This is the main open call.*
- **D3** — health key: `HEALTH_DATA_ENCRYPTION_KEY` env + AES-256-GCM with a key-id prefix now, KMS/rotation at P13 (my rec).
- **D4** — add **both** remaining roles now (`OCCUPATIONAL_PHYSICIAN` for health, `WORKS_COUNCIL` read-only), grant `EHS_SPECIALIST` `incidents.write`, `MANAGER` org-unit-scoped `incidents.*` (my rec) vs. physician only.
- **D5** — report channels: logged-in + manual (admin/EHS enters a reported incident) now, **anonymous QR deferred** (my rec) vs. build the anonymous unauth channel in P10.
- **D6** — **confirm the drafted statutory-notification deadlines and retention periods** in `SLD_P10_STATUTORY_NOTIFICATIONS_DRAFT.md` against the official sources (RIS §363 ASVG, gesetze-im-internet §193 SGB VII, fedlex UVG/VUV) before I seed. The CH 3-day figure in particular needs your UVG/VUV read — Suva's own wording is "so rasch wie möglich".
- **D7** — the reserved per-person chemical exposure registers (`SUBSTANCE_EXPOSURE_KM`/`_R`, DE §10a GefStoffV / AT / CH): keep structure reserved, build the surface only once a chemical-exposure-measurement capture path exists (my rec) vs. build the register now.

On your decisions I'll build in slices, each `tsc`/Biome/Vitest green, migrations applied live with CHECK/RLS/encryption round-trip re-verified, HTTP-verified, demo fixture updated:
- **P10a** — incidents core: `IncidentType`/`IncidentStatus` enums, `Incident` + `IncidentInvestigation`, the one-of-five `Action` source, lib gates (`createIncident`/`transitionIncident`/`setInvestigation`), module UI (reports/investigations lists + case detail), schema-test extension, EN/DE/RO. **No person, no health yet.**
- **P10b** — people on incidents: `IncidentInvolvedPerson` (people→people FK), the involved-person UI, the "do not put names in the narrative" discipline, audit.
- **P10c** — health sub-compartment: `IncidentHealthDetail`, `health-crypto.ts`, the physician-only `readIncidentHealthDetail()` with the audited-read rule, `OCCUPATIONAL_PHYSICIAN` role, the schema-test health assertion.
- **P10d** — statutory notifications: the (approved) `IncidentNotificationRule` catalogue, `StatutoryNotification`, the pre-filled country-gated print view, the deadline clock, `WORKS_COUNCIL` role.
- **P10e** — Verbandbuch view + the (approved) incident/health/first-aid retention rows and the deletion-batch mechanics; demo fixture (person-free incident + one with an involved person + a physician-only health row behind the role).

---

*Drafted by Claude Code for founder review. No legal value in this note or the accompanying draft is treated as verified; every deadline and retention period stops for your confirmation against the official source before it is seeded or shown in UI.*
