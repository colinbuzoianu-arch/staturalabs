# SLD restructure plan — Statura Labs Dynamics as a live OSH & environment platform for DACH

**Context for CC.** Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md` and `SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md` fully before starting. This plan **supersedes every earlier plan on priority order**. H0–E4 are built and stay; their rules on completeness, provenance, versioned catalogues and the OSH/environment domain split stay in force. Nothing here reopens camera capture.

**Product owner:** Colin Buzoianu, Verumsell SRL. Statura Labs Dynamics is a proprietary product built and owned by Verumsell; this plan is the founder's own product design.

Founder direction (Oct 2026):
1. **Structure before more features.** Settle modules, routes, roles, the shared object model and the country layer now, before anything else is built on today's shape.
2. **A live, complete product**, not a demo. Every module below is built to production quality and sold to real customers.
3. **Left sidebar navigation**: every module reachable from one vertical menu, top to bottom. The current header-only "basic app" look goes away.
4. **Market: DACH** — Austria, Germany, Switzerland. Country-specific law, terminology and documents per site. Romania stays in the enum for internal/dev use only and is not a sales market for SLD.

---

## 1. Diagnosis — what today's shape can't carry

| Problem | Where it shows | Consequence if we keep building |
|---|---|---|
| **No module concept** | The hub under `(app)/workstations/[id]`, environment and actions under `(app)/administration/...`, risk overview under `(app)/sites/[id]/risk-overview`. | Every new module adds another ad-hoc route branch; no per-module licensing possible. |
| **"Administration" mixes two jobs** | `administration/sites/[siteId]/*` holds both master data (org units, catalogue, floor plans) and operational work (assessments, actions, environment). | Assessors work inside an admin area; roles can't separate "work" from "configure". |
| **Actions bound to their source page** | Reached only via a finding, session or environmental finding; per-site list in admin. | Inspections, incidents, substances and audits will all raise actions — they need one register. |
| **No document layer** | Generated PDFs are never stored; no uploads except floor plans. | No proof of what was issued when; every module would invent its own uploads. |
| **No people layer** | The product has no way to prove who was instructed or who had an accident. | Unterweisungsnachweise and accident records are statutory in all three countries — a live product must hold them (§3). |
| **Country layer is Austria-first** | `CountryPack` has an AT environmental block; SGD/AWK are AT-only; DE/CH packs are thin. | Germany and Switzerland can't be sold. |
| **Visual system is a theme only** | Brand tokens in `globals.css`, `AppHeader` + page, hand-styled tables. | The app keeps looking like a prototype. |

Conclusion: **foundation and shell first** (P0–P3), then re-home existing features, then the new modules.

---

## 2. Target shape

### 2.1 Module map

Stable module keys (code, routes, entitlement). Labels are i18n; German shown. Where DE/AT/CH use different legal terms, the label comes from the site's `CountryPack` (§4.3), not the dictionary.

| Key | Label (DE) | Purpose | State |
|---|---|---|---|
| `cockpit` | Cockpit | Site/company overview: overdue items, completeness, KPIs | Partly built |
| `my-tasks` | Meine Aufgaben | Personal inbox: my actions, inspections, approvals, notifications | New |
| `risk` | Gefährdungsbeurteilung / Evaluierung | Workstation hub, hazard-category completeness, findings, ergonomics, exposure, statutory documentation | **Built**, extend (§6) |
| `inspections` | Begehungen & Audits | Configurable inspections, audits, compliance checklists; observations → findings/actions | New |
| `incidents` | Ereignisse | Accidents, occupational illness suspicions, near misses, first aid, fire, property damage, spills, authority visits; investigation; statutory notifications | New |
| `environment` | Umwelt | Environmental aspects, quantities, waste streams, waste-management documents | **Built**, extend to DE/CH |
| `actions` | Maßnahmen | One register for actions from every source; calendar; effectiveness check | **Built**, promote |
| `chemicals` | Gefahrstoffe | Substance register, safety data sheets, operating instructions, where used | New |
| `training` | Unterweisungen | Requirements, sessions, per-person proof, instruction matrix | New |
| `people` | Personen | Minimal employee register for training proof and incident cases (restricted, §3) | New |
| `legal` | Rechtskataster | Applicable law per site, compliance evaluation, review cycle | New |
| `documents` | Dokumente | Library + archive of every generated document | New |
| `reports` | Auswertungen | KPIs, standard reports, exports | Partly built |
| `settings` | Stammdaten & Einstellungen | Organisation, users & roles, catalogues, templates, notifications, modules, integrations | Built (as `administration`), restructure |

Cross-cutting services (no menu entry of their own): notifications, attachments, audit events, module entitlement, subject model, country packs, i18n, search.

### 2.2 Shared object model — rules every module follows

1. **Every record hangs off a `Site`** (`siteId` NOT NULL; authorization stays site-based via the `require*Access` wrappers), optionally narrowed to a **subject**: `OrgUnit`, `Workstation`, `Process` or `Task`. One helper in `src/lib/subject/` validates "subject belongs to site" (pattern: `addTaskToProcess`).
2. **One action engine.** All modules raise actions through `Action` + `transitionAction()`. Extend the exactly-one-source CHECK per new source (inspection observation, incident, substance, legal requirement) with hand-written migrations, as in E1.
3. **One document layer.** `Document` / `DocumentVersion` / `DocumentLink` (one nullable FK per linkable type + exactly-one CHECK — no stringly `entityType/entityId`). Supabase Storage, path scoped by company/site (pattern: `src/lib/storage/floor-plan.ts`).
4. **Every generated document is archived** as `GeneratedDocument`: type, scope, country, generating user, timestamp, methodology/matrix/catalogue versions used, SHA-256, storage path. Regeneration never overwrites.
5. **Lifecycle is data**: status enum + transition table + append-only event table (pattern: `ActionStatus`/`ActionStatusEvent`). Human review gates stay; nothing auto-approves.
6. **Catalogues and templates are versioned data**: system rows (`companyId IS NULL`) + company additions; single-active-version where a version drives evaluation (pattern: `MethodologyVersion`).
7. **Every legal reference, limit, deadline and cycle comes from a country-scoped versioned catalogue** (§4) with source link and verification date. Missing values show as an honest gap; no fallback to another country.
8. **OSH and environment stay separate domains** (§3.17). Shared modules (actions, documents, inspections, legal register) carry an explicit `domain` per record; artifacts never mix vocabularies.
9. **Global audit log**: `AuditEvent` (actor, action, entity, before/after diff for regulated fields, timestamp, IP hash) written by one helper from every mutation in regulated modules (incidents, people, training proof, approvals).

### 2.3 Routes

```
/app                               → last-used site cockpit
/app/s/[siteId]/<moduleKey>/…      all site-scoped modules
/app/company/…                     cross-site views (company_admin)
/app/settings/…                    master data and configuration
/app/me/…                          my tasks, profile, notifications
/admin                             super_admin tool (unchanged, stays plain)
```

The site is carried in the URL (shareable links, access check on `siteId`). Every existing URL gets a permanent redirect from one redirect map, with a test that every old pattern resolves.

### 2.4 Module registry

`src/lib/modules/registry.ts` is the single source for menu, route guards and entitlement:

```ts
interface ModuleDefinition {
  key: ModuleKey;
  menuGroup: "overview" | "assess" | "control" | "evidence";
  domain: "osh" | "environment" | "shared";
  order: number;                       // position in the sidebar
  requiresEntitlement: boolean;        // cockpit, my-tasks, actions, documents, settings: false
  permission: Permission;              // fine-grained, see §3.3
  basePath: (siteId: string) => string;
  icon: IconName;
  children: SubItem[];                 // second-level menu entries
  badge?: BadgeSource;                 // e.g. overdue actions count
}
```

Entitlement is data: `CompanyModule` (companyId, moduleKey enum, enabledAt, enabledByUserId), super_admin-only write. Non-entitled modules don't appear in the menu and their routes 404.

---

## 3. People data — how a live product handles it

A live DACH OSH product must hold some person data: instruction proof (who was instructed, when, on what), accident records and statutory notifications, first-aid records. The product keeps its core promise by **compartmentalising** it, not by avoiding it.

### 3.1 The rule (replaces the "no person data anywhere" reading of §1)

- **The assessment chain stays person-free, unchanged.** `Workstation → Task → PostureSample/PostureZoneScore → BodyRegionScore`, `RiskAssessment → RiskFinding`, `EnvironmentalAssessment`, exposure measurements, inspections of conditions: no person reference, ever. Ergonomic and risk scores describe the job.
- **A separate people compartment** (`people`, `training` proof, `incidents` case data) holds person data only where a statutory duty requires it. No foreign key from any assessment-chain table into it, and no view or report joins the two. Enforced by a test that inspects the Prisma schema for forbidden relations.
- **Health data is a sub-compartment** inside incidents (injury type, body part, incapacity days, medical treatment). Separate tables, separate permission (`health_data.read/write`), field-level encryption at rest for free-text medical fields, every read logged in `AuditEvent`.
- **Platform users ≠ persons.** `PlatformUser` (who logs in) and `Person` (an employee record) are separate tables; a `Person` may optionally link to a `PlatformUser` for self-service (seeing one's own instruction status).

### 3.2 Person register (`people`)

`Person`: first/last name, optional personnel number, org unit, employment start/end, active flag, optional `platformUserId`. **No** date of birth, address, nationality, health data, performance data, or any other HR field. Import via CSV and an import API (SFTP/REST connector as a later integration). Retention: deactivated persons are anonymised after the longest applicable retention period for their linked records (catalogue per country, §4).

`PersonAssignment` (person ↔ workstation or org unit, with validity dates) exists **only** to derive instruction requirements. It is never shown on assessment screens, never used in risk reports, and analytics on it are limited to "instruction coverage".

### 3.3 Roles and permissions

Move from four hard-coded roles to **roles = bundles of permissions** (permissions are code constants; role bundles are data per company, with system defaults):

| System role | Typical holder | Scope |
|---|---|---|
| `super_admin`, `l3_support` | Founder / support | Platform (unchanged) |
| `company_admin` | EHS head | All sites of the company |
| `site_admin` | Site EHS lead | Assigned sites, incl. configuration |
| `ehs_specialist` | Sicherheitsfachkraft / Fachkraft für Arbeitssicherheit / ASA-Spezialist | Assess, inspect, investigate, approve on assigned sites |
| `manager` | Line manager | Own org units: actions, instructions, incident reports, read assessments |
| `occupational_physician` | Arbeitsmediziner/Betriebsarzt | Read health sub-compartment, add medical notes |
| `works_council` | Betriebsrat / Personalvertretung | Read-only, aggregates and documents, no health data, no person lists |
| `employee` | Every employee (optional licence) | Report events/observations, see own instructions, confirm instruction |

Plus an **anonymous reporting link per site** (QR code) for observations/near misses without login; reporter identity is not stored unless the reporter chooses to leave a contact.

### 3.4 Analytics limits

Aggregates by site, org unit, workstation, category, month/quarter. A minimum group size (data, default 5) is enforced in one query helper for every person-derived statistic. No slicing by weekday × org unit, by shift × person, or any ranking of individuals.

### 3.5 Compliance doc changes (P0)

Rewrite §1 of `ERGO_COMPLIANCE_BY_DESIGN.md` into: *scores describe the job; person data exists only in the people compartment, only for statutory duties, never linked to scoring*. Add mandate §3.18 (compartment rule, health sub-compartment, audit logging, minimum group size, no person→assessment link) and §3.19 (DACH country layer, §4). Add never-build entries:
- Never link a `Person` to any assessment-chain table, score, finding or environmental record.
- Never show who works at a workstation on an assessment, ergonomic or risk screen or document.
- Never rank, score or compare individual persons.
- Never read health-compartment data without the `health_data.read` permission and an audit event.
- Never let a notification describe an individual's behaviour or health.
- Never store a person attribute that is not listed in §3.2 without a documented statutory reason.

---

## 4. DACH country layer

### 4.1 Principle

Every site has `country ∈ {AT, DE, CH}` (RO kept for dev). The country decides: terminology, which statutory documents exist, legal references shown, limits, deadlines, retention periods, notification forms. All of it lives in **versioned, country-scoped catalogues**, each row carrying the legal source (RIS / gesetze-im-internet.de / fedlex.admin.ch / DGUV / Suva link), the consolidated-version date, and a `verifiedAt` + `verifiedBy`. CC drafts catalogue content with source links; **the founder verifies each legal row before it is seeded** (the existing RIS-verification bar, extended to DE and CH). Nothing legal is hard-coded in components.

### 4.2 Legal map per module

Starting references for CC to draft from — each must be checked against the official consolidated text before seeding.

| Module | Austria | Germany | Switzerland |
|---|---|---|---|
| Risk assessment & documentation | ASchG §§4–5, DOK-VO; psychische Belastungen in §4 | ArbSchG §§5–6 (incl. §5 Abs. 3 Nr. 6 psychische Belastung); DGUV Vorschrift 1 | VUV Art. 11a ff., EKAS-Richtlinie 6508 (ASA); ArGV 3 Art. 2 ff. |
| Expert personnel | ASchG §§73 ff. (SFK, Arbeitsmedizin) | ASiG; DGUV Vorschrift 2 | EKAS 6508 (ASA-Spezialisten) |
| Workplaces | AStV | ArbStättV + ASR | ArGV 3, ArGV 4 |
| Work equipment | AM-VO | BetrSichV | VUV, EKAS-Richtlinien |
| Noise / vibration | VOLV | LärmVibrationsArbSchV | VUV; Suva-Grenzwerte |
| PPE | PSA-V | PSA-BV | VUV Art. 5 |
| Hazardous substances | ASchG (Abschnitt Arbeitsstoffe), GKV | GefStoffV (incl. Gefahrstoffverzeichnis, Betriebsanweisung), TRGS 400/555/900 | ChemG/ChemV; Suva-Grenzwerte am Arbeitsplatz |
| SDS (all) | REACH Art. 31 + Annex II, CLP | same | ChemV (aligned with REACH/CLP) |
| Instruction | ASchG §14 | ArbSchG §12, DGUV Vorschrift 1 §4, GefStoffV §14 | VUV Art. 6, ArGV 3 Art. 5 |
| Accident records & notification | ASchG §16 (records); ASVG §363 (AUVA-Unfallmeldung) | SGB VII §193 (Unfallanzeige); DGUV Vorschrift 1 §24 (Erste-Hilfe-Dokumentation / Verbandbuch) | UVG Art. 45 (Unfallmeldung an den Versicherer, z. B. Suva) |
| Occupational medicine | ASchG §§49 ff., VGÜ | ArbMedVV | VUV Art. 70 ff. |
| Waste | AWG 2002 §10 (Abfallwirtschaftskonzept), §11 (Abfallbeauftragter) | KrWG (incl. Abfallbeauftragter), GewAbfV | USG, VVEA |
| Environmental management | ISO 14001, EMAS | ISO 14001, EMAS | ISO 14001 |
| Data protection & co-determination | DSGVO, DSG; ArbVG §§96, 96a | DSGVO, BDSG (scope of §26 after EuGH C-34/21 to check); BetrVG §87 Abs. 1 Nr. 6 and 7 | nDSG (in force since 1 Sep 2023); ArGV 3 Art. 26; Mitwirkungsgesetz |

### 4.3 Terminology and documents per country (`CountryPack`)

| Concept | AT | DE | CH |
|---|---|---|---|
| Risk assessment | Arbeitsplatzevaluierung | Gefährdungsbeurteilung | Gefährdungsermittlung und Risikobeurteilung |
| Statutory document | Sicherheits- und Gesundheitsschutzdokument (SGD) | Dokumentation der Gefährdungsbeurteilung | Dokumentation nach EKAS 6508 / Sicherheitskonzept |
| Safety expert | Sicherheitsfachkraft (SFK) | Fachkraft für Arbeitssicherheit (Sifa) | ASA-Spezialist / Sicherheitsbeauftragter |
| Occupational physician | Arbeitsmediziner/in | Betriebsarzt/-ärztin | Arbeitsarzt/-ärztin |
| Accident notification | AUVA-Unfallmeldung | Unfallanzeige (UV-Träger/BG) | Unfallmeldung UVG (Suva / Versicherer) |
| Substance register | Arbeitsstoffverzeichnis | Gefahrstoffverzeichnis | Chemikalienverzeichnis |
| Waste document | Abfallwirtschaftskonzept (AWK) | betriebliches Abfallkonzept (where applicable) | Entsorgungskonzept |
| Works council | Betriebsrat | Betriebsrat / Personalrat | Arbeitnehmervertretung |
| Spelling | de-AT | de-DE | de-CH (no ß) |

Generators: extend SGD/AWK into a **document-type catalogue per country**: AT (SGD, AWK, AUVA-Unfallmeldung data sheet, Arbeitsstoffverzeichnis), DE (GBU documentation, Unfallanzeige pre-fill, Gefahrstoffverzeichnis, Betriebsanweisung, Unterweisungsnachweis), CH (risk assessment documentation, UVG accident report pre-fill, Chemikalienverzeichnis). Official authority forms are **pre-filled data exports or print views**, never imitations of the authority's own form layout; the user submits through the official channel.

UI languages: German with de-AT / de-DE / de-CH variants, English. French and Italian for CH as a later milestone (structure the dictionaries for it now). Romanian stays for internal use.

### 4.4 Hosting and contracts (live product)

EU hosting (Supabase/Vercel EU regions, Frankfurt). CH customers are served from the EU (Switzerland recognises EU adequacy). Deliver: AVV/DPA (Art. 28 DSGVO, nDSG equivalent), TOMs document, sub-processor list, DPIA template customers can reuse for incidents/health data, a works-council information pack generated per customer (extension of the existing worker briefing).

---

## 5. Navigation and design

### 5.1 Left sidebar — the menu, top to bottom

One full-height, fixed vertical menu on the left. Every module is reachable here; nothing lives only in a top bar.

```
┌──────────────────────────────┐
│  [Logo] STATURA LABS DYNAMICS │
│  ▾ Standort: Werk Linz (AT)   │  site switcher; "Alle Standorte" for company_admin
│  ⌕ Suchen …        [+ Neu]    │  global search · quick create (Ereignis, Maßnahme, Begehung …)
├──────────────────────────────┤
│  ÜBERSICHT                    │
│  ◻ Cockpit                    │
│  ◻ Meine Aufgaben        (4)  │
├──────────────────────────────┤
│  BEURTEILEN                   │
│  ◻ Gefährdungsbeurteilung     │  label per country pack
│     · Arbeitsplätze           │
│     · Prozesse                │
│     · Beurteilungen           │
│     · Ergonomie               │
│     · Lageplan                │
│  ◻ Begehungen & Audits        │
│     · Geplant · Durchgeführt · Vorlagen
│  ◻ Ereignisse            (1)  │
│     · Meldungen · Untersuchungen · Behördenmeldungen
│  ◻ Umwelt                     │
│     · Umweltaspekte · Mengen & Abfall · Konzepte
├──────────────────────────────┤
│  STEUERN                      │
│  ◻ Maßnahmen             (7)  │
│     · Liste · Kalender · Wirksamkeit
│  ◻ Gefahrstoffe               │
│     · Verzeichnis · Sicherheitsdatenblätter · Betriebsanweisungen
│  ◻ Unterweisungen        (3)  │
│     · Matrix · Termine · Nachweise · Anforderungen
│  ◻ Personen                   │  only with people.read
├──────────────────────────────┤
│  NACHWEISEN                   │
│  ◻ Rechtskataster             │
│  ◻ Dokumente                  │
│     · Bibliothek · Erzeugte Dokumente
│  ◻ Auswertungen               │
│     · Kennzahlen · Berichte · Export
├──────────────────────────────┤
│  (pinned to bottom)           │
│  ⚙ Stammdaten & Einstellungen │
│     · Organisation · Benutzer & Rollen · Kataloge · Vorlagen
│     · Benachrichtigungen · Module · Integrationen
│  ? Hilfe                      │
│  ◉ Colin B. ▾                 │  profile, language, theme, sign out
│  « Einklappen                 │
└──────────────────────────────┘
```

Behaviour:
- **Generated from the module registry** (`order`, `menuGroup`, `children`, `badge`, `permission`, entitlement). No hand-written menu markup per page.
- Sub-items expand in place for the active module (accordion); one module open at a time; active item highlighted with an accent bar.
- **Collapse** to a 64 px icon rail with tooltips; state persisted per user. Expanded width ~264 px.
- **Badges**: overdue/open counts from one server query per page load, cached briefly.
- Items the user lacks permission for, or the company isn't entitled to, are not rendered.
- Below 1024 px the sidebar becomes an off-canvas drawer with a top bar holding the menu button, site and search.
- Full keyboard navigation, visible focus, ARIA `navigation` landmark with `aria-current`.
- Present mode hides the sidebar entirely (existing `PresentModeShell` behaviour).
- The main area gets a slim **page header** (breadcrumbs, title, status chip, primary action), not a second navigation.

### 5.2 Design system

- **Tokens**: keep the brand (teal / ivory / coral / sage) and extend `globals.css` into surface levels, text levels, borders, **status colours** (risk bands, check states, overdue, severity) passing WCAG AA in both themes, spacing and type scale, radii, elevation, focus ring. Components use tokens only.
- **Primitives** in `src/components/ui/`: button, input, select, combobox, textarea, checkbox/radio, date picker, badge/status chip (generated from enums), data table (sort, filter, column chooser, saved views), tabs, drawer, dialog, tooltip, toast, card, progress, calendar/agenda, timeline, file upload, empty state, sidebar.
- **Page patterns**: list page, detail page (header + tabs + side panel with links/history), checklist page (the hub's completeness pattern, reused by inspections), form drawer, wizard (incident report, inspection run), print view.
- **Density**: compact desk-tool density by default; touch-sized targets on the floor-walk screens (hub, inspection run, incident report) for tablets.
- **Theme**: light becomes the default for the work app (data-dense screens, printing, projector use); dark stays available. Marketing keeps its own look.
- **Dependencies**: headless primitives (e.g. Radix) and one icon set are acceptable; propose with a one-line reason. No pre-styled UI kit used as-is.
- Out of scope: PDF layouts (own print design), `/admin`.

---

## 6. Gefährdungsbeurteilung — extensions

Additive to the built hub:

- **Header attributes** on `RiskAssessment`: routine / non-routine activity, number of persons exposed (count only), shift pattern, product/part reference, process description, applicable legal references (from the country catalogue), review interval and next review date.
- **Step link**: `RiskFinding.taskId` (task ∈ assessed workstation/process, via the subject helper). `Task` stays the "step"; no new entity.
- **Per-finding requirements**: `FindingPpeRequirement` → versioned PPE catalogue; `FindingTrainingRequirement` → `TrainingRequirementType`; `FindingSubstance` → `Substance`; safe-work-method text.
- **Typical measures per hazard** (versioned system data, founder-reviewed wording) offered as suggestions when raising actions — never auto-created.
- **Derived views**: PPE matrix, instruction matrix and substances-in-use per workstation; all feed the country's statutory document as extra sections.
- **Review cycle**: next-review date per assessment; an incident, a changed substance or a closed action at a workstation flags its assessment "Überprüfung erforderlich" (the legal trigger wording per country comes from the catalogue).
- **Country generalisation**: hub, completeness and documents work for DE and CH sites with their pack's terminology and references.

---

## 7. New modules — scope

### 7.1 Maßnahmen
Register across all sources; filters by source, status, due date, responsible person, subject, domain; **calendar/agenda**; detail page with status timeline, documents and effectiveness verification; bulk reassign; UI for environmental-finding actions (deferred item).

### 7.2 Dokumente
Upload, versioning, categories (procedure, permit, certificate, SDS, inspection evidence, training material, external report, authority correspondence), links to any record, review-due dates, read-confirmation campaigns (e.g. a new operating instruction to be confirmed by assigned persons). Plus the archive of all generated documents. Production prerequisites: file-type allowlist, size limits, malware scanning.

### 7.3 Begehungen & Audits
- `InspectionTemplate` (versioned; system/company/site): type (walk-through, audit, equipment inspection, compliance checklist, ISO 45001/14001 internal audit), sections, questions, answer types (yes/no/n.a., scale, number + unit, text, choice, photo/file evidence), result types, severity levels, scoring, legal reference per question from the catalogue.
- `Inspection` instance: template version, site + subject, planned/performed date, team (`PlatformUser`s), status PLANNED → IN_PROGRESS → COMPLETED → CLOSED; recurring schedules.
- **Observations**: deviation → action and/or promotion to a `RiskFinding` (explicit click).
- Tablet-friendly run mode, works with flaky connectivity (offline queue for answers and photos, sync on reconnect).
- Photos document conditions; the UI asks users not to photograph people, and an upload notice states it.

### 7.4 Ereignisse
- Event types (catalogue): Arbeitsunfall, Wegeunfall, Berufskrankheit-Verdacht, Beinaheunfall, Erste-Hilfe-Fall, Brand, Sachschaden, Umweltereignis/Leckage, Fahrzeugereignis, Security-Vorfall, Gewalt/Übergriff, Behördenbesuch/Beanstandung, Sonstiges.
- Flow: report (logged-in, mobile, or anonymous QR) → triage → investigation (sequence of events, direct/root causes, contributing factors, 5-Why / Ishikawa as structured fields) → actions → closure → assessment review flag.
- **Person data only in the case compartment** (§3): involved persons by `Person` reference, health details in the health sub-compartment.
- **Statutory notification support** per country: deadline clock from the catalogue (e.g. the DE Unfallanzeige deadline, the AT AUVA notification, CH UVG notification), a pre-filled data sheet/print view, a "submitted on / reference number" record. No direct submission to authorities in v1.
- First-aid book (DE Verbandbuch equivalent, per country) as an event type with its own retention.
- Environmental events also create/flag records in the environment domain without mixing artifacts.

### 7.5 Gefahrstoffe
`Substance` (trade name, manufacturer, CAS/EC, CLP classification as structured fields: pictograms, signal word, H/P statements, physical state), `SafetyDataSheet` (versions, revision date, language, supplier; age and missing-language alerts), `SubstanceUse` (site + subject, purpose, quantity class, storage location, exposure route), **operating instruction** generator (Betriebsanweisung, per country template), the country's substance register document, substitution check field, links to `CHEMICAL` findings, environmental aspects and waste streams. Optional later: SDS PDF data extraction with human confirmation.

### 7.6 Unterweisungen
- `TrainingRequirementType` (title, content outline, recurrence, legal reference from catalogue, delivery: in person / e-learning link / document read-confirmation).
- Requirements derived from workstation, process, finding, substance and org unit; persons get requirements through `PersonAssignment`.
- `TrainingSession` (date, instructor, topics, attendees) and `TrainingRecord` (person, requirement, date, method, confirmation: signature on tablet or self-confirmation by logged-in employee, valid until).
- **Instruction matrix** (persons × requirements, status colours), due lists, manager view for own org units, printable attendance list and proof per person.

### 7.7 Personen
Register per §3.2, CSV import with mapping and dry-run, deactivation/anonymisation workflow, export for data-subject access requests (one person's records across the compartment).

### 7.8 Rechtskataster
`LegalRequirement` catalogue per country (law, provision, short obligation text written fresh, source link, domain OSH/environment, applicability criteria), per-site applicability (suggested from site attributes and active modules, confirmed by a human), compliance evaluation (compliant / partially / not compliant / not applicable, evidence links, evaluator, date), review cycle, change log when a catalogue version updates. Supports ISO 45001 / 14001 compliance-evaluation requirements.

### 7.9 Benachrichtigungen (service)
`NotificationRule` (event, scope, recipients by user/role/permission, channel email + in-app, lead time, digest). Events: actions due/overdue, verification due, assessment review due, inspection due, incident reported, notification deadline approaching, SDS outdated, instruction due/overdue, document review due, legal requirement review due. In-app inbox under "Meine Aufgaben". Email through one provider abstraction with EU sending.

### 7.10 Auswertungen & Cockpit
`KpiDefinition` as versioned data (key, label, formula over aggregates, unit, domain, country variant). System set: accident counts and rates (incidents per 1 000 employees and per million hours worked, both from configurable headcount/hours inputs per site and period), lost days, near-miss ratio, open/overdue actions, action effectiveness rate, assessment completeness and overdue reviews, instruction coverage, inspection completion, SDS currency, waste quantities, environmental significance. Site and company cockpits, configurable dashboard per user, export per chart and report (CSV, XLSX, PDF), multi-year comparison. Minimum group size enforced (§3.4).

### 7.11 Stammdaten & Einstellungen
Organisation (company, sites with country, org tree, workstations, processes), users and role bundles, catalogues (hazards, PPE, training types, event types, KPI set, measures), templates (inspection, document), notification rules, module entitlement (read-only for tenants), integrations (CSV import, later SSO and HR connector), data retention settings within the country minimums.

---

## 8. Production readiness (live product)

- **Auth**: invite + self-service password reset, MFA (TOTP) required for admin/specialist/health-data roles, SSO (SAML/OIDC) for enterprise plans, session timeout, immediate offboarding.
- **Tenancy & security**: RLS **policies** written for every table and the runtime switched to a non-owner role (CLAUDE.md's open hardening item), rate limiting, CSP, dependency scanning, quarterly restore test of backups, point-in-time recovery enabled.
- **Billing**: plans per module bundle and site/employee band; Stripe; invoices from Verumsell SRL; trial companies auto-expire.
- **Onboarding**: company setup wizard (sites with country, org import, people import, first workstation), sample data toggle, in-app help per module.
- **Operations**: error monitoring, uptime monitoring, status page, structured logs without person data, admin impersonation only with audit event and customer-visible log.
- **Legal pack**: AGB, AVV/DPA, TOMs, sub-processor list, privacy notice, DPIA template, works-council pack, per country.
- **Data portability**: full company export (JSON + documents) and documented deletion at contract end.

---

## 9. Milestone order

| # | Milestone | Size |
|---|---|---|
| **P0** | Docs: plan into repo, CLAUDE.md, compliance doc §1 rewrite + §3.18/§3.19 + never-build entries | S |
| **P1** | Foundation: module registry, `CompanyModule`, subject helper, permission-based roles, `AuditEvent`, new route tree + redirects | M |
| **P2** | Design system + left sidebar shell; design preview reviewed by founder; all `(app)` pages migrated | L |
| **P3** | Country layer: catalogue model with verification fields, DE/CH packs, terminology, generalise hub + statutory document to DE/CH | M |
| **P4** | Re-home + promote: risk, environment out of admin, Maßnahmen module, Dokumente + generated archive, Cockpit v1, Meine Aufgaben | M |
| **P5** | Notifications service | M |
| **P6** | Gefährdungsbeurteilung extensions (§6) | M |
| **P7** | Personen + Unterweisungen | L |
| **P8** | Gefahrstoffe | L |
| **P9** | Begehungen & Audits | L |
| **P10** | Ereignisse (incl. health sub-compartment) | L |
| **P11** | Rechtskataster | M |
| **P12** | Auswertungen & KPIs | M |
| **P13** | Production readiness (§8) — security items start in P1 and run alongside; billing/onboarding/legal pack complete here | L |

P0–P4 must be complete before P5+. After P4 the order may change by customer demand; tell the founder before reordering.

---

## 10. What not to let drift

- No module page outside the registry, the `/app/s/[siteId]/<key>` tree, the sidebar and the primitives.
- One action engine, one document layer, one subject helper, one audit helper, one notification service.
- The assessment chain never touches person data; the people compartment never feeds scores.
- No legal text, limit, deadline or retention period without a country-scoped catalogue row, source link and founder verification. No fallback between AT, DE and CH.
- OSH and environment never share an artifact.
- Completeness is never inferred — hub, inspections, legal register.
- Authority forms are pre-filled data, never look-alike copies of the authority's layout.
- Every old URL redirects.
- Existing engineering rules unchanged: hand-written migrations, enum-only migration before first use of a value, RLS on every table, `Restrict` FKs, append-only histories, tsc/Biome/Vitest green per commit, every string in the i18n dictionaries, German end-to-end on AT, DE and CH demo sites.

---

## 11. CC prompt sequence

**P0**
> Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md`, `SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md` and `SLD_RESTRUCTURE_PLAN_platform-modules.md` fully. No code. Apply §3.5 to the compliance doc (rewrite §1, add §3.18 and §3.19, never-build entries, bump revision). Update CLAUDE.md: product framing (live DACH OSH + environment platform, module list with built/new status, left-sidebar navigation), this plan as the current priority document, and the people-compartment rule. Show me the diff.

**P1**
> Build the module registry (§2.4), `CompanyModule` (enum-only migration first, RLS, super_admin-only write; all modules enabled for demo/dev companies), `src/lib/subject/`, permission constants + role bundles per §3.3 (migrate existing roles without changing current access), and `AuditEvent` with one write helper. Move existing pages into the §2.3 route tree without visual change; one redirect map + a test for every old pattern. Verify over HTTP as company_admin and site_admin.

**P2**
> Propose the design system per §5.2 and the left sidebar per §5.1 on a dev-only `/app/_design` route: tokens in both themes, all primitives, the sidebar (expanded, collapsed, mobile drawer) and three page mockups (workstation hub, Maßnahmen list, inspection run) with demo data. Propose any dependency with a one-line reason. Stop for my review. After approval: build the shell with the registry-driven sidebar and migrate every `(app)` page, one module per commit, present mode still working.

**P3**
> Build the country catalogue model (legal source link, consolidated-version date, verifiedAt, verifiedBy) and extend `CountryPack` for DE and CH per §4.3 (terminology, document types, de-AT/de-DE/de-CH dictionary variants). Draft the §4.2 catalogue rows for the risk module with official source links and give me the list to verify before seeding. Generalise the hub and statutory document generator to DE and CH. Add DE and CH demo sites.

**P4**
> Per §2.2 and §7.1–7.2: Maßnahmen module (register, calendar, detail, environmental-finding actions), Dokumente (`Document`/`DocumentVersion`/`DocumentLink` with exactly-one CHECK, read-confirmation campaigns) and `GeneratedDocument` archiving for every existing PDF route, environment out of administration into its module (plus the deferred site-map domain toggle), Cockpit v1, Meine Aufgaben. DE/EN, demo fixture updated.

**P5–P12**
> One milestone per prompt per §6–§7. For every legal reference, deadline, retention period or limit, draft the catalogue rows with official source links (RIS, gesetze-im-internet.de, fedlex, DGUV, Suva) and stop for my verification before seeding or writing UI text. For P7 and P10, start with a short design note on the compartment boundary (tables, permissions, audit, retention, the schema test from §3.1) before code.

**P13**
> Work through §8 as a checklist; propose the order, then build. RLS policies and the non-owner runtime role first.
