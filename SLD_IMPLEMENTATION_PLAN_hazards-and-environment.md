# SLD implementation plan — full hazard coverage, simplified posture, environment module

**Context for CC.** Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md`, `SLD_IMPLEMENTATION_PLAN_austria-first.md` and `SLD_IMPLEMENTATION_PLAN_posture-input.md` first. Where this plan and the demo-loop plan disagree on priority, this plan wins. The Austria-first plan's rules on verification, the country boundary and provenance still apply in full. Nothing here reopens camera capture.

Founder direction (Oct 2026), in his own framing:
1. Video/capture is no longer the centre of the product. Forget it.
2. Posture should be far more general: low / medium / heavy, for trunk, head, arms, legs. That level, not per-joint.
3. **What matters most is what cannot be entered today:** every hazard category in the site-map filter (Physikalisch/mechanisch, Lärm, Vibration, Beleuchtung, Klima/Hitze, Chemisch, Staub, Biologisch, Ergonomisch, Psychosozial, Elektrisch, Brand/Explosion, Strahlung).
4. Environmental protection must become part of Statura Labs Dynamics, with a plan.

---

## 1. Diagnosis — why the categories "can't be entered"

The schema is **not** the problem. `RiskFinding → Hazard → HazardCategory` already covers all 13 categories, `ExposureMeasurement` already attaches instrument values, and `PsychosocialFindingDetail` already shows how to add category-specific detail. The gaps are all in the product layer:

| Gap | Where it shows | Consequence |
|---|---|---|
| **No entry point in the main flow** | Site → Workstation shows only the task list; each task leads to "Aufnahme starten". Findings can only be added at `administration/risk-assessments/[id]`, three levels deep, behind admin navigation. | An assessor walking the floor never meets the 12 non-ergonomic categories. The site-map filter shows categories the user has no visible way to fill. |
| **Thin catalogue** | The system `Hazard` seed has 1–2 rows per category (15 in total plus PSYCH-02). Only `COMPANY_ADMIN` can add more. | A site admin picks from a list that rarely matches what they see. The category reads as "not supported". |
| **No negative findings** | A category can only show up as a *present* hazard. | The core legal deliverable of an Evaluierung (§4/§5 ASchG) is proof that **every** hazard type was considered, including "not present" and "not applicable". Today that can't be documented, so the SGD can't show completeness. |
| **Capture-era naming** | `captureSample: "Aufnahme starten"`, `capturePage`, route `/tasks/[id]/capture`, and the workstation page lists tasks first. | The UI still tells the user the product is a camera tool, which contradicts CLAUDE.md. |

Conclusion: the work is mostly **an assessor-facing, workstation-centric checklist over the model that already exists**, plus one small schema addition for category completeness. It is not a new risk engine.

---

## 2. Target shape — one walk-through, two results

The assessor stands at a workstation and runs one structured pass:

```
Arbeitsplatz "Presse 3"
├─ Gefährdungen (ASchG-Evaluierung)          ← the 13 HazardCategories, each with a status
│   ├─ Lärm ............ ● vorhanden   → finding (P×S, measurement 88 dB(A) vs VOLV), action
│   ├─ Beleuchtung ..... ✓ geprüft, keine Gefährdung
│   ├─ Strahlung ....... — nicht zutreffend
│   ├─ Ergonomisch ..... ● vorhanden   → Körperhaltung (zones), Lasten, Wiederholung
│   └─ …
└─ Umweltaspekte (ISO 14001 / AWG)           ← the new, separate domain (§5)
    ├─ Abfall .......... ● relevant    → waste stream "Sägespäne", 120 t/a
    ├─ Energie ......... ● relevant    → 410 MWh/a, compressed air leakage
    └─ Abwasser ........ ✓ geprüft, nicht relevant
```

Outputs: the existing SGD/Evaluierung document (now with a completeness table) and, later, the environmental register and the Austrian Abfallwirtschaftskonzept (§6).

Pitch line: *„Ein Rundgang, zwei Nachweise: Evaluierung nach ASchG und Umweltaspekte nach ISO 14001 — am selben Arbeitsplatz, mit derselben Maßnahmen-Wirksamkeitsprüfung."*

---

## 3. H1 — full hazard coverage (do this first)

### 3.1 Schema: category completeness

One new model. No change to `RiskFinding`.

```prisma
enum CategoryCheckStatus {
  NOT_APPLICABLE        // nicht zutreffend — the hazard type cannot occur here
  CHECKED_NO_HAZARD     // geprüft, keine Gefährdung — could occur, assessed, none found
  HAZARD_PRESENT        // vorhanden — at least one RiskFinding of this category must exist
  OPEN                  // noch offen — not yet assessed (explicit, never inferred)
}

model HazardCategoryCheck {
  id               String              @id @default(cuid())
  riskAssessmentId String
  category         HazardCategory
  status           CategoryCheckStatus
  rationale        String?             // required for NOT_APPLICABLE and CHECKED_NO_HAZARD (app + CHECK)
  checkedByUserId  String              @db.Uuid
  checkedAt        DateTime
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  riskAssessment RiskAssessment @relation(fields: [riskAssessmentId], references: [id], onDelete: Restrict)

  @@unique([riskAssessmentId, category])
  @@index([riskAssessmentId])
}
```

Rules, each enforced by a lib gate in the `createAssessmentSession()` / M3 pattern, with a pure, unit-tested core:
- Creating a `RiskAssessment` writes one `OPEN` row per `HazardCategory` in the same transaction. The rows are created explicitly, never inferred at read time (§3.11 discipline).
- `HAZARD_PRESENT` ⇔ at least one `RiskFinding` of that category exists. Adding the first finding flips the status automatically. Removing the last one is not possible, because findings are append-only.
- `DRAFT → IN_REVIEW` is **blocked while any category is `OPEN`**. The error names the open categories. This is the completeness proof, and it is the feature to sell.
- Hand-added CHECK `HazardCategoryCheck_rationale_check`: `rationale IS NOT NULL` when status ∈ {NOT_APPLICABLE, CHECKED_NO_HAZARD}. Copy the `ManualInput_value_shape_check` pattern and re-verify that the database rejects bad rows, not only the app.
- Migration order per the known gotcha: enum-only migration first, then the table, then the backfill. Existing assessments get **`OPEN`** rows for every category without a finding and `HAZARD_PRESENT` for those with one. Never backfill `CHECKED_NO_HAZARD`: we didn't check, so we don't claim we did.

### 3.2 Catalogue: from 15 to roughly 70 system hazards

Seed through a migration, with **5–8 system hazards per category** plus one `XXX-99 "Sonstige Gefährdung (beschreiben)"` per category. Picking a `-99` hazard requires `notes`. That gives the assessor a reliable fallback without needing a company admin.

Source the list from the categories in the AUVA Evaluierung guidance and the ASchG structure (work equipment, workplaces, substances, physical agents, psychological strain). Write the names fresh; don't copy AUVA wording. Indicative content for CC to expand and the founder to review:

| Category | Examples (codes indicative) |
|---|---|
| PHYSICAL_MECHANICAL | crush/shear points, falling objects, slip/trip/fall on level, fall from height, moving vehicles/forklift traffic, sharp edges, pressurised systems |
| NOISE | continuous machine noise, impulse noise (presses, hammering), noise impairing communication/warning signals |
| VIBRATION | hand-arm (grinders, impact tools), whole-body (forklifts, mobile machinery) |
| LIGHTING | insufficient illuminance, glare/reflections, flicker, missing emergency lighting, no daylight/visual contact outside |
| CLIMATE_THERMAL | heat from processes, outdoor heat/sun, cold work (cold stores, outdoors), draught, humidity |
| CHEMICAL | solvents, adhesives/resins (formaldehyde), cleaning agents, oils/coolants (skin), CMR substances, gases/fumes from processes |
| DUST_PARTICULATE | wood dust (hardwood: carcinogenic), quartz/mineral dust, metal/welding fume, inhalable/respirable general dust |
| BIOLOGICAL | mould, contaminated water/aerosols (coolant, legionella), animal/waste handling, first-aid/blood contact |
| ERGONOMIC_MSD | awkward posture, lifting/carrying, pushing/pulling, repetitive movement, prolonged standing/sitting, VDU work |
| PSYCHOSOCIAL | (existing PSYCH-01/-02) + time pressure, monotony, lone working, shift/night work, conflict with customers/third parties |
| ELECTRICAL | defective equipment/cabling, work near live parts, static discharge, missing inspection of mobile equipment |
| FIRE_EXPLOSION | flammable liquids/gases, combustible dust (ATEX), hot work, missing escape routes/extinguishers |
| RADIATION | welding UV, lasers, IR from hot surfaces, EMF (induction heating), ionising sources (gauges) |

Verification bar: hazard names and descriptions are **not legal values**, so they don't need the RIS check. Any legal reference placed in a description still needs the §4.5 treatment. Prefer leaving references out of the catalogue and keeping them in `ExposureLimit`.

Allow `SITE_ADMIN` to create company hazards **inline from the finding form** (still `companyId`-scoped, `isSystem=false`). The admin-only rule exists for library hygiene; the `-99` row plus inline creation is what makes the form usable on the floor. This needs a decision: keep inline creation `COMPANY_ADMIN`-only if the founder wants library control.

### 3.3 UI: the workstation becomes the hub

`(app)/workstations/[workstationId]` is restructured:
1. **Header action "Evaluierung starten / fortsetzen"** creates a DRAFT `RiskAssessment` for this workstation, or opens the current one. This is now the primary call to action.
2. **Category checklist**: 13 rows. Each row has a status chip and, when expanded, an inline finding form. Reuse `AddFindingFields`, filtered to that category's hazards, plus P/S, existing controls, notes, an optional measurement (reusing `ExposureLimitFields`, which already handles the AT catalogue) and "Maßnahme anlegen". For NOT_APPLICABLE and CHECKED_NO_HAZARD, a one-line rationale is required.
3. **Progress bar**: "11 von 13 Kategorien beurteilt". The submit-for-review button is disabled until every category is assessed, and it lists what is missing.
4. **Tasks move below** as "Tätigkeiten — ergonomische Detailbeurteilung", reached only from the ERGONOMIC_MSD row.

The admin detail page stays as the review/approval surface, read-mostly. Don't build a second write path that drifts. Both pages call the same server actions, moved to `src/lib/risk/` if they currently live inline in the page.

Renames, with no behaviour change: `captureSample` → "Belastung erfassen", `capturePage` → `assessmentPage`, route `/tasks/[id]/capture` → `/tasks/[id]/assess` with a permanent redirect from the old path. Remove the remaining "Aufnahme"/"capture" wording from user-facing copy in de/en/ro. Internal identifiers (`PostureSample.capturedAt`) stay.

### 3.4 Reports

- SGD / Evaluierung PDF gains a **completeness table**: category | status | rationale or number of findings | highest band. This page answers an Arbeitsinspektor's first question.
- `deriveAppliedStandards()` adds a category's references only when that category is `HAZARD_PRESENT`.
- Site map: the filter is unchanged, but a workstation with `OPEN` categories gets a "unvollständig" marker. Fail-visible, matching the no-silent-gaps rule in §3.15.

### 3.5 Verification bar (H1)
- Unit tests: the pure completeness core (`canSubmitForReview(checks, findings)`), the status-flip rule and the backfill mapping.
- A DB-level rejection test for the rationale CHECK.
- HTTP walkthrough in German on the AT demo site: start an Evaluierung from the workstation, set 13 statuses (at least one each of N/A, no-hazard and present with a VOLV-checked noise measurement), confirm submission is blocked with one category open and allowed once all are set, and confirm the PDF shows the completeness table.
- Demo fixture (`seed-demo-fixture.mjs`) updated so the demo account shows a complete and an incomplete workstation side by side.

---

## 4. H2 — posture by body zone (low / medium / high)

### 4.1 The decision

The B11 per-region category picker (17 regions, joint-level tiers) stays as **"Detailbeurteilung"**. The new default is a **zone rating**:

| Zone | Covers (existing `BodyRegion`s) |
|---|---|
| Kopf / Nacken | NECK |
| Rumpf | TRUNK, HIP |
| Schultern / Arme | SHOULDER_*, UPPER_ARM_*, ELBOW_*, FOREARM_* |
| Hände / Handgelenke | WRIST_* |
| Beine / Knie | KNEE_*, ANKLE_* |

Per zone the assessor picks:
- **Belastung**: gering / mittel / hoch (plus "nicht beurteilt")
- **Dauer-/Häufigkeitsanteil**: selten / gelegentlich / überwiegend. Optional, defaults to "gelegentlich", and the default is shown.

At task level, independently: **Lastgewicht** keine / leicht / mittel / schwer. The kg bands are **derived from the seeded `ManualHandlingRule` rows** of the active methodology and never hardcoded, the same principle as B11. This is the founder's "low / medium / heavy".

### 4.2 Scoring: still data, still versioned

New table under the existing `MethodologyVersion`, seeded as methodology `v3-2026-10`. Activate it in a separate step after re-scoring parity is checked, the same two-step process as B3.

```prisma
enum BodyZone { HEAD_NECK TRUNK SHOULDERS_ARMS HANDS_WRISTS LEGS_KNEES }
enum ZoneLoadLevel { LOW MEDIUM HIGH }
enum ExposureShare { RARE OCCASIONAL PREDOMINANT }

model PostureZoneRule {
  id                 String        @id @default(cuid())
  methodologyVersion String
  zone               BodyZone
  level              ZoneLoadLevel
  share              ExposureShare
  riskBand           RiskBand
  riskScore          Int
  methodology MethodologyVersion @relation(fields: [methodologyVersion], references: [version], onDelete: Restrict)
  @@unique([methodologyVersion, zone, level, share])
}

model PostureZoneScore {   // parallel sub-score, never blended with BodyRegionScore
  id                 String        @id @default(cuid())
  postureSampleId    String
  zone               BodyZone
  level              ZoneLoadLevel
  share              ExposureShare
  riskBand           RiskBand
  riskScore          Int
  methodologyVersion String
  postureSample PostureSample @relation(fields: [postureSampleId], references: [id], onDelete: Restrict)
  @@unique([postureSampleId, zone])
}
```

- `manualAngles.entryMode` gains `"zone"`. A zone-mode sample writes `PostureZoneScore` rows and **no** `BodyRegionScore` rows. A zone rating must never be turned into fake per-joint degrees (§3.16 provenance). `buildRegionResults` reports zone samples through a new, additive `ZoneResult` union. The existing `RegionResult` shape is untouched (see the dashboard-stability note in CLAUDE.md).
- The 3 × 3 matrix per zone is the founder's call to author, with an inspiration line to ISO 11226 / EN 1005-4 and the observational screening logic common in DACH. **§3.7: no LMM/KIM point values, pictograms or wording.** Write the zone descriptions fresh, for example "Rumpf — mittel: deutlich gebeugt oder verdreht, Hände unter Kniehöhe gelegentlich".
- Hold time doesn't apply in zone mode. It is replaced by `share`. State this in the report method sentence.

### 4.3 UI and reports
- Task page: five rows of three-way button groups, plus share and load. Fits a phone screen. The "Detailbeurteilung (Gelenke)" toggle opens the existing B11 picker, and the expert degree mode stays behind that.
- PDF: "Rumpf: mittel, gelegentlich — Mittel" plus the method sentence "Einstufung der beobachteten Körperhaltung nach Körperzonen (ISO 11226 / EN 1005-4 orientiert), keine Winkelmessung."
- The ERGONOMIC_MSD row in the H1 checklist shows the worst zone band across the workstation's tasks.

### 4.4 Verification bar (H2)
Unit tests for the zone-rule lookup (every zone × level × share combination resolves to exactly one rule) and for load-class derivation from `ManualHandlingRule`. A parity check that historical B11/degree samples render unchanged. An HTTP walkthrough with a zone sample and a detailed sample side by side on one task.

---

## 5. E1–E3 — environment module ("Umweltaspekte")

### 5.1 Framing decisions (record in ERGO_COMPLIANCE_BY_DESIGN.md as §3.17)

1. **Environment is a separate domain, not more `HazardCategory` values.** `HazardCategory` means worker protection under ASchG. Mixing "Abwasser" into it would leak into the SGD, the worker briefing, the psychosocial rules and the AT limit catalogue. Use a new enum `EnvironmentalAspectCategory`.
2. **Reuse the loop, not the vocabulary.** `RiskAssessment`, `RiskFinding`, `Action`, `IMPLEMENTED → VERIFIED` and the re-assessment trend are exactly what ISO 14001 §6.1.2 → §8.1 → §9.1 needs: aspect → significance → operational control → monitoring and evidence. The verification loop is still the product.
3. **Environmental data names no person.** The same rule as §1 applies. Waste contractors are companies, and responsible parties are `PlatformUser` accounts or role labels.
4. **Every legal statement is country-scoped and RIS-verified before seeding** (§3.15 extends to environmental law unchanged).

### 5.2 Schema (E1)

```prisma
enum AssessmentDomain { OCCUPATIONAL_SAFETY ENVIRONMENT }

enum EnvironmentalAspectCategory {
  AIR_EMISSIONS            // Luftemissionen (Staub, VOC, Formaldehyd, Verbrennungsabgase)
  ENERGY_USE               // Energieverbrauch (Strom, Gas, Druckluft, Wärme) → THG
  WATER_USE                // Wasserverbrauch
  WASTEWATER               // Abwasser (Indirekt-/Direkteinleitung)
  WASTE_NON_HAZARDOUS      // nicht gefährliche Abfälle
  WASTE_HAZARDOUS          // gefährliche Abfälle
  RAW_MATERIALS            // Rohstoff- und Materialeinsatz, Verpackung
  HAZARDOUS_SUBSTANCES     // Lagerung/Umgang wassergefährdender Stoffe, Leckage
  SOIL_GROUNDWATER         // Boden- und Grundwassergefährdung
  NOISE_NEIGHBOURHOOD      // Lärm nach außen (Nachbarschaft)
  ODOUR                    // Geruch
  LIGHT_EMISSIONS          // Lichtemissionen nach außen
  TRANSPORT_LOGISTICS      // betrieblicher Verkehr, Logistik
  BIODIVERSITY_LAND_USE    // Flächenversiegelung, Biodiversität, Grünflächen
}

enum OperatingCondition { NORMAL ABNORMAL EMERGENCY }   // ISO 14001 requires all three
```

- `RiskAssessment.domain AssessmentDomain NOT NULL`, explicitly backfilled to `OCCUPATIONAL_SAFETY` (never a column default at read time). Extend the existing hand-added CHECK: an ENVIRONMENT assessment may be **site-level** (workstationId and processId both null), because a boiler house or wastewater plant is often not a workstation.
- `EnvironmentalAspect` is a catalogue table mirroring `Hazard` (system rows plus company rows) with `category EnvironmentalAspectCategory`.
- `RiskFinding.hazardId` becomes nullable, with a new `environmentalAspectId` (nullable) and a hand-added CHECK requiring **exactly one**, matching the parent assessment's domain (lib gate plus DB CHECK). Also add `operatingCondition OperatingCondition` (nullable for OSH, required for ENVIRONMENT, enforced by the CHECK) and `legallyRelevant Boolean`.
- `EnvironmentalCategoryCheck` uses the same shape as H1's `HazardCategoryCheck`, keyed on `EnvironmentalAspectCategory`, with the same completeness gate. Build H1 so that this is a copy, not a rewrite.
- **Significance**: reuse the 5 × 5 `RiskMatrixVersion` with environment-specific axis labels (Ausmaß der Umweltauswirkung × Häufigkeit/Wahrscheinlichkeit). `significant = riskBand ∈ {ELEVATED, HIGH} OR legallyRelevant`. Derive it in a pure, tested function and store it on the finding at write time for traceability.
- `Action` gains `environmentalMeasureType` (nullable enum: AVOID, REDUCE, REUSE, RECYCLE, RECOVER, DISPOSE_SAFELY, SUBSTITUTE, TECHNICAL, ORGANISATIONAL, MONITORING), used instead of `HierarchyOfControl` when the domain is ENVIRONMENT. A CHECK ensures exactly one of the two is set according to domain.

### 5.3 Quantities (E2)

```prisma
model EnvironmentalQuantity {
  id            String   @id @default(cuid())
  riskFindingId String
  value         Float
  unit          String         // kWh, MWh, m³, t, kg, Nm³
  periodStart   DateTime
  periodEnd     DateTime
  source        String         // "Zählerstand", "Rechnung", "Schätzung" — provenance (§3.16 analogue)
  isEstimate    Boolean
  notes         String?
  riskFinding RiskFinding @relation(fields: [riskFindingId], references: [id], onDelete: Restrict)
}

model WasteStream {
  id                String   @id @default(cuid())
  siteId            String
  wasteCode         String          // AT: Schlüsselnummer per Abfallverzeichnisverordnung / ÖNORM S 2100 — verify
  name              String
  hazardous         Boolean
  originWorkstationId String?
  originProcessId     String?
  annualQuantity    Float?
  unit              String?
  collectorCompany  String?         // Entsorger (company, never a person)
  treatment         String?         // Verwertung / Beseitigung
  riskFindingId     String?         // links to the WASTE_* aspect finding
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

Estimates are allowed but are always labelled as estimates in the UI and PDFs. The environmental counterpart of "manual entry never masquerades as measurement".

**No CO₂ calculation in E2.** Converting energy to tCO₂e needs versioned, country-scoped emission factors, which means an `EmissionFactorCatalogVersion` with the same verification bar as the limit catalogue (source: Umweltbundesamt AT). That is E4, built only when a customer asks for it.

### 5.4 UI (E3)
- The workstation hub from H1 gets a second section, **Umweltaspekte**, with the same checklist pattern and 14 rows. Site-level environmental assessments live on the site page ("Standort-Umweltbewertung").
- Site map: a domain toggle above the category filter, **Arbeitnehmerschutz | Umwelt**, with each domain's own category list. This answers "where do we stand on environment" in the same view the customer already uses.
- **Umweltaspekte-Register** page per site: every significant aspect, its quantities, open actions and verification status. This is the ISO 14001 §6.1.2 artefact an auditor asks for.

---

## 6. E4 — Austrian Abfallwirtschaftskonzept generator (the environmental "SGD")

Why this is the commercial wedge: it is a **hard legal duty, not voluntary**. Per WKO guidance, every Austrian facility (Anlage) with **more than 20 employees** needs an Abfallwirtschaftskonzept (AWK), updated **at least every seven years** and after significant waste-relevant changes. The structure mirrors the SGD exactly: a legally required document, generated from data the assessor already entered, and kept current. The founder's sales motion for SLD in Austria is already "we produce the document you are obliged to have."

- `src/lib/report/AwkDocument.tsx`, built like `SgdDocument.tsx`: site data, processes, waste streams (code, name, hazardous, quantity, origin, treatment, collector), planned waste-avoidance and recycling measures (from `Action`s with `environmentalMeasureType`), organisational responsibilities (role labels) and the update history.
- Country-pack driven (`packs/at.ts` gains `environmental.legalReferences`). DE and CH get stubs that **show the gap** rather than borrowing AT content (§3.15, no fallback).
- **Verification bar before any customer sees it:** the required AWK contents must be checked against the AWG 2002 text in RIS by a human, and the references written into the migration comment, in the same discipline as the VOLV seed. The 20-employee threshold and 7-year update cycle above come from WKO secondary guidance and are not yet RIS-verified.

Later, and only on customer pull:
- **E5** Energy and greenhouse-gas summary (Scope 1/2) on a verified emission-factor catalogue, aligned to the EU voluntary SME standard (VSME). After Omnibus I (in force since 18 Mar 2026), CSRD applies only above 1,000 employees and €450M turnover, and value-chain requests to smaller companies are capped at the voluntary standard. SLD's customers will receive these requests from their large customers, so "answer your customer's sustainability questionnaire from data you already have" is the hook. Don't sell SLD as a CSRD tool.
- **E6** Legal register (bindende Verpflichtungen, ISO 14001 §6.1.3) with review dates. Check overlap with the GED product first, because an expiry-tracking register may belong there with an integration rather than being duplicated.
- Seveso, IED and emissions permit monitoring are out of scope. They belong to specialist tools and large sites.

---

## 7. Milestone order and effort

| # | Milestone | Size | Why this position |
|---|---|---|---|
| H0 | Docs: compliance doc §3.17 (environment domain), CLAUDE.md product framing, this plan referenced | S | Mandates before schema |
| H1a | `CategoryCheckStatus` enum-only migration, then `HazardCategoryCheck` + backfill + CHECK | S | Completeness is the legal core |
| H1b | Catalogue expansion seed (~70 hazards, `-99` rows) | S | Makes every category usable |
| H1c | Workstation hub UI + capture renames + review gate | M | **The visible fix for "can't be entered"** |
| H1d | SGD completeness table, site-map incomplete marker, demo fixture | S | Demo-ready for prospects |
| H2 | Zone posture (rules, scores, UI, PDF), methodology v3 | M | Simplification asked for |
| E1 | Environment domain schema (enum migration first) + catalogue seed | M | Foundation |
| E2 | Quantities + waste streams | S–M | Data for the register and AWK |
| E3 | Environment UI: checklist, site toggle, register | M | Visible environmental value |
| E4 | AWK generator (AT), RIS-verified | M | First environmental legal document |
| E5/E6 | GHG summary / legal register | — | Only on customer pull |

H1 should be fully done before E1 starts, because E1 copies H1's patterns. H2 can run in parallel with E1 if needed.

---

## 8. What not to let drift

- **No inferred completeness.** A category is OPEN until a human sets it. No backfill or default ever writes CHECKED_NO_HAZARD.
- **The two domains stay separate.** No environmental category in `HazardCategory`, no environmental row in the SGD, no worker-protection row in the AWK.
- **Zones never become fake angles.** Zone, category and degree samples each keep their own provenance in every artefact.
- **No unverified legal number or duty**, environmental or OSH, reaches a customer. This includes the AWK threshold above until it has been checked against RIS.
- **No CO₂ figures without a versioned, sourced factor catalogue.**
- **The camera stays gone.** Nothing in this plan needs it.

---

## 9. CC prompt sequence

**H0**
> Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md`, `SLD_IMPLEMENTATION_PLAN_austria-first.md`, `SLD_IMPLEMENTATION_PLAN_posture-input.md` and `SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md` fully. No code this step. Add mandate §3.17 (environment as a separate assessment domain reusing the risk/action/verification loop, no person data, country-scoped verified legal content) and the matching §4 never-build entries from §8 of the new plan. Update CLAUDE.md: product framing (workstation hub, all hazard categories, environment module planned) and a pointer to the new plan as the current priority document.

**H1a**
> Hand-write an enum-only migration for `CategoryCheckStatus`. Then a second migration adding `HazardCategoryCheck` per §3.1 with the hand-added `HazardCategoryCheck_rationale_check` (pattern: `ManualInput_value_shape_check`), RLS enabled, and an explicit SQL backfill: one row per existing RiskAssessment × HazardCategory, `HAZARD_PRESENT` where a finding of that category exists, otherwise `OPEN`. Never write `CHECKED_NO_HAZARD` in a backfill. Build `src/lib/risk/category-check.ts` with a pure `canSubmitForReview` core and unit tests, wire `createRiskAssessment` to create the 13 OPEN rows in the same transaction, and wire the DRAFT→IN_REVIEW transition to the gate. Prove the CHECK rejects at DB level.

**H1b**
> Seed the expanded system hazard catalogue per §3.2 in a migration (5–8 per category plus one `-99` "Sonstige" per category). Names written fresh, no AUVA/LMM wording, no legal numbers in descriptions. Make `notes` required server-side when a `-99` hazard is picked. Show me the full list for review before applying.

**H1c**
> Restructure `(app)/workstations/[workstationId]` into the hub per §3.3: start/continue Evaluierung, the 13-row category checklist with inline finding forms (reuse `AddFindingFields` and `ExposureLimitFields`, move server actions into `src/lib/risk/` so the admin detail page and the hub share one write path), a progress indicator, and the review gate listing open categories. Rename capture wording per §3.3 in de/en/ro and move `/tasks/[id]/capture` to `/tasks/[id]/assess` with a permanent redirect. German end-to-end on the AT demo site over HTTP.

**H1d**
> Add the completeness table to the SGD/Evaluierung PDF, the "unvollständig" marker on the site map, and update `seed-demo-fixture.mjs` to show one complete and one incomplete workstation. Verify the PDF text with `pdfjs-dist` (temporary, as before).

**H2**
> Build zone-based posture per §4. Enums in an enum-only migration first. `PostureZoneRule` seeded under a new inactive methodology `v3-2026-10` (copy all v2 rules forward unchanged plus the zone rules; I will author the 5×3×3 band table, so ask me for it, do not invent it). `PostureZoneScore` as a parallel sub-score. `entryMode: "zone"` in `manualAngles`. The additive `ZoneResult` in `buildRegionResults`. Load classes derived from `ManualHandlingRule`. Zone UI as the default with the B11 picker behind "Detailbeurteilung". Re-score parity check, then activate v3 in a separate step.

**E1–E4**
> One milestone per prompt, per §5–§6. Before E4, stop and give me the list of AWG 2002 provisions the AWK must satisfy, with RIS links, for human verification. Do not generate the document template until I confirm.
