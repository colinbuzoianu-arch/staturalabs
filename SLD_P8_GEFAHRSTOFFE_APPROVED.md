# SLD P8 — Gefahrstoffe: founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-04. Delegated desk research and review by Claude, accepted by the founder.
**Replaces** `SLD_P8_GEFAHRSTOFFE_DRAFT.md` as the build input. Seed only what §3 lists. `verificationMethod` per row as stated (`official` / `mirror` / `seed-check`, as defined in the P3 approval). CC: follow §5.

---

## 1. Answers to CC's five questions

| # | Question | Decision |
|---|---|---|
| 1 | GHS pictograms + signal words; no full H/P catalogue in v1 | **Approved.** Seed GHS01–GHS09 and the two signal words (§3.1). H/P codes are entered from the SDS. Validate the format, don't validate against a catalogue. |
| 2 | Betriebsanweisung structure + DE/AT anchors | **Approved with corrections** (§3.2). DE stays **§ 14 Abs. 1 GefStoffV**. The 2024 renumbering moved only the exposure register (old § 14 Abs. 3 → new § 10a), not the Betriebsanweisung. AT anchor: **§ 14 ASchG** (Unterweisung, incl. written instructions). |
| 3 | Substance register anchors + columns | **DE approved:** § 6 Abs. 12 GefStoffV. **AT corrected:** no separate statutory register was found, so the AT document is an *Arbeitsstoffliste* forming part of the evaluation (§ 41 and § 5 ASchG). It must not claim to be a stand-alone statutory register (§3.3). |
| 4 | Retention + P8/P10 boundary | **CC's recommendation approved: the per-person exposure register goes to P10.** It needs date of birth and sex (AT § 47), which are outside the P7 person fields and belong in the health-adjacent compartment. **The draft's AT row was wrong:** in AT the employer keeps the register until exposure ends and then transmits it to the accident insurer, who keeps it ≥40 years. P8 seeds the SDS rows (REACH Art. 36) and reserves the exposure record types (§3.4). |
| 5 | Schema shape | **Approved with two changes** (§2): `SubstanceUse` uses **explicit nullable FKs + an exactly-one CHECK**, not a loose `subjectType`/`subjectId`. And `isCmr` is replaced by **three category fields**. `TrainingRequirementType.retentionOverride` is approved. |

---

## 2. Schema (approved shape)

All FKs `Restrict`, RLS on, enum-only migrations first, hand-written migrations.

- **`Substance`**:
  - `companyId` (required; no system substances in v1), `tradeName`, `manufacturer?`, `casNumber?`, `ecNumber?`
  - `physicalState` enum, `signalWord` enum (`GEFAHR` | `ACHTUNG` | `NONE`)
  - `carcinogenicCategory` / `mutagenicCategory` / `reprotoxicCategory`, each an enum (`CAT_1A` | `CAT_1B` | `CAT_2` | `NONE`). Derived helpers: `isCmr1A1B()` (DE § 10a scope) and `isCmrAny()` (AT § 47 scope covers the hazard classes without restricting to 1A/1B). The retention and exposure logic in P10 reads these, never a single boolean.
  - `substitutionCheckDone` (bool), `substitutionCheckNote?`, `substitutionCheckedAt?`
  - Optional links (explicit nullable FKs): `environmentalAspectId?`, `wasteStreamId?`.
- **`SubstancePictogram`**: `substanceId` + `GhsPictogram` enum, unique pair.
- **`SubstanceStatement`**: `substanceId`, `kind` (`H` | `P` | `EUH`), `code`, `text?`. Format CHECK, e.g. `^H[2-4][0-9]{2}[A-Za-z]{0,3}$`, `^EUH[0-9]{3}[A-Za-z]?$`, `^P[1-5][0-9]{2}(\+P[1-5][0-9]{2})*$`.
- **`SafetyDataSheet`**: `substanceId`, `version?`, `revisionDate`, `language` (BCP-47), `supplier?`, `documentId` (FK into the P4 document layer, malware scan as there), `supersededAt?`, `lastUsedAt?` (drives retention, §3.4).
- **`SubstanceUse`**: `substanceId`, `siteId`, **exactly one of** `workstationId?` / `processId?` / `orgUnitId?` (CHECK, pattern: `Action_exactly_one_source_check`), `purpose`, `quantityClass` enum (`XS` <1 kg/l · `S` 1–10 · `M` 10–100 · `L` 100–1000 · `XL` >1000, per year), `storageLocation?`, `exposureRoute` (enum set: `INHALATION`, `DERMAL`, `ORAL`, `EYE`), `activeFrom`, `activeTo?`. Person-free. The workstation FK is fine here: substances describe the job, so this is not the people compartment.
- **Training wiring:** the reserved `SUBSTANCE` source (P7b A.2) becomes derivable. A substance with an active use at a workstation, process or org unit makes the linked `TrainingRequirementType`s required for persons assigned there. Same "why" output.
- **`TrainingRequirementType.retentionOverride?`**: ISO 8601 duration + trigger, validated like `CompanyRetentionSetting`.
- **Findings link:** `FindingSubstance` (P6 §6) becomes active: a `CHEMICAL` or `DUST_PARTICULATE` finding can reference substances.

---

## 3. Approved content

### 3.1 CLP reference data (EU, Regulation (EC) No 1272/2008)
Seed as enum + German/English labels (pictogram names per CLP Annex V):

| Code | DE | EN |
|---|---|---|
| GHS01 | Explodierende Bombe | Exploding bomb |
| GHS02 | Flamme | Flame |
| GHS03 | Flamme über einem Kreis | Flame over circle |
| GHS04 | Gasflasche | Gas cylinder |
| GHS05 | Ätzwirkung | Corrosion |
| GHS06 | Totenkopf mit gekreuzten Knochen | Skull and crossbones |
| GHS07 | Ausrufezeichen | Exclamation mark |
| GHS08 | Gesundheitsgefahr | Health hazard |
| GHS09 | Umwelt | Environment |

Signal words: **Gefahr / Danger**, **Achtung / Warning**. Pictogram graphics: use the official UNECE GHS pictogram files (public), stored as static assets. Don't redraw them.

### 3.2 Betriebsanweisung (operating instruction for a hazardous substance)

**Legal anchors (seed into the P3 legal catalogue):**

| # | Country | Reference | Obligation (our wording) | sourceUrl | Method |
|---|---|---|---|---|---|
| GS-DE-1 | DE | GefStoffV § 14 Abs. 1 | Schriftliche Betriebsanweisung, die der Gefährdungsbeurteilung Rechnung trägt, in verständlicher Form und Sprache zugänglich machen | https://www.gesetze-im-internet.de/gefstoffv_2010/__14.html | seed-check |
| GS-DE-2 | DE | TRGS 555 | Technische Regel: Betriebsanweisung und Information der Beschäftigten (Gliederung, Gestaltung) | https://www.baua.de/DE/Angebote/Regelwerk/TRGS/TRGS-555.html | seed-check |
| GS-AT-1 | AT | ASchG § 14 | Unterweisung inkl. schriftlicher Anweisungen; bei Einführung neuer Arbeitsstoffe zwingend | (reuse AT-4 from P3) | mirror |

The current consolidated GefStoffV was last amended **17.12.2025** (per a consolidated mirror). CC reads the exact Stand at seed time.

**Template structure (approved), German only, country-gated AT/DE, fail-closed like the SGD:**
- **Kopf:** Betrieb, Arbeitsbereich/Arbeitsplatz, Tätigkeit, Nummer, Stand (date), verantwortlich (role or PlatformUser, never a worker name).
1. **Gefahrstoffbezeichnung:** trade name, hazardous components (from the SDS).
2. **Gefahren für Mensch und Umwelt:** pictograms, signal word, H statements as text.
3. **Schutzmaßnahmen und Verhaltensregeln:** technical, organisational and PPE measures, in hierarchy order (reuses the P6 tiers).
4. **Verhalten im Gefahrfall:** spill, fire, emergency number.
5. **Erste Hilfe:** per exposure route, first-aider contact.
6. **Sachgerechte Entsorgung:** waste route, linked waste stream if set.
- **Fuß:** "Erstellt auf Grundlage des Sicherheitsdatenblatts vom <revisionDate>" plus the legal anchor line for the site's country (from the catalogue, never hard-coded).

Design: a coloured frame is the common practice convention for substance Betriebsanweisungen (orange). Apply it as a style, not as a legal claim.

- **Generation rules:**
  - The generator fills from the substance, its current SDS and the uses.
  - The output is a **draft** that a human must approve (status DRAFT → APPROVED, with approver and date) before it can be printed as valid.
  - Every approved version is archived via `GeneratedDocument`.
  - If the substance's SDS gets a new revision, open Betriebsanweisungen show "Überprüfung erforderlich".

### 3.3 Substance register document

| Country | Document title | Legal anchor | Method |
|---|---|---|---|
| DE | **Gefahrstoffverzeichnis** | GefStoffV § 6 Abs. 12, https://www.gesetze-im-internet.de/gefstoffv_2010/__6.html | seed-check |
| AT | **Arbeitsstoffliste** (Teil der Evaluierung) | ASchG § 41 (Ermittlung und Beurteilung von Arbeitsstoffen) with § 5 ASchG / DOK-VO documentation, reuse the P3 rows | mirror |

- **DE columns** (minimum content per § 6 Abs. 12): Bezeichnung des Gefahrstoffs · Einstufung bzw. gefährliche Eigenschaften · Mengenbereich im Betrieb · Arbeitsbereiche, in denen Beschäftigte exponiert sein können · Verweis auf das Sicherheitsdatenblatt. Extra columns allowed: pictograms, CMR categories, substitution check status.
- **AT columns:** same columns. The document header says *"Arbeitsstoffliste als Bestandteil der Arbeitsplatzevaluierung"*. It must **not** say "gesetzlich vorgeschriebenes Verzeichnis".
- **Low-hazard exception (DE):** GefStoffV § 6 Abs. 13 allows excluding substances with only low hazard. Add `excludedLowHazard` (bool + rationale) on `Substance`. Excluded substances are listed in an appendix, never silently dropped.
- Per site, generated on request, archived via `GeneratedDocument`.

### 3.4 Retention rows (add to the P7b catalogue, version `v2-2026-11`)

New `RetentionRecordType` values: `SDS`, `SUBSTANCE_USE`, and reserved for P10 (no rows seeded): `SUBSTANCE_EXPOSURE_KM`, `SUBSTANCE_EXPOSURE_R`. New trigger value: `LAST_USE`.

| country | recordType | basis | minRetention | trigger | source | Method |
|---|---|---|---|---|---|---|
| AT | SDS | STATUTORY | P10Y | LAST_USE | REACH Art. 36(1): downstream users keep all required information, incl. SDS, ≥10 years after last use, https://eur-lex.europa.eu/eli/reg/2006/1907/oj | mirror |
| DE | SDS | STATUTORY | P10Y | LAST_USE | same | mirror |
| AT, DE | SUBSTANCE_USE | POLICY_DEFAULT | P10Y | LAST_USE | aligned with REACH Art. 36 (company may extend) | — |

**Reserved for P10, documented now so the design stays right:**

| country | Record | Rule (to seed in P10 with re-check) |
|---|---|---|
| DE | Exposure register, carcinogenic/mutagenic Cat. 1A/1B | GefStoffV § 10a: kept **40 years after end of exposure**. The employee receives an extract when leaving. Can be transferred to the accident insurer / the DGUV's central exposure database (ZED). |
| DE | Exposure register, reprotoxic Cat. 1A/1B | GefStoffV § 10a: **5 years** (new since the Dec 2024 amendment) |
| AT | Verzeichnis der Arbeitnehmer (carcinogenic, mutagenic, reprotoxic, biological groups 3/4) | ASchG § 47: kept by the employer **until end of exposure, then transmitted to the competent accident insurer** (e.g. AUVA), **which keeps it ≥40 years**. Contents include name, date of birth, sex, substances, type and duration of activity and exposure. P10 must build an **export/transmission** function, not a 40-year retention at the employer. |

**Instruction records for CMR substances (policy suggestion, not statute):** when a `TrainingRequirementType` is linked to a substance with any CMR category 1A/1B, pre-fill its `retentionOverride` with **40 years after end of employment** (`POLICY_DEFAULT`, editable). The UI note says: *"Empfehlung zur Beweissicherung bei Langzeitlatenz, keine gesetzliche Frist."*

### 3.5 SDS alerts
- **Missing language (statutory):** the SDS must be supplied in an official language of the member state where it is supplied (REACH Art. 31(5)). For AT and DE sites, alert when a substance in active use has **no current SDS with `language` = de**. Seed the reference in the legal catalogue (mirror, EUR-Lex link as above).
- **Age (policy, no statute):** prompt for a review if the current SDS `revisionDate` is older than **2 years** (company setting, default 2 years). The UI note says *"Empfehlung, keine gesetzliche Frist; maßgeblich ist die aktuelle Fassung des Lieferanten."*
- **Superseded:** uploading a newer revision sets `supersededAt` on the old one. It is kept, never deleted, and retention runs from `lastUsedAt`.

---

## 4. Out of scope for P8
- The per-person exposure register (AT § 47 / DE § 10a), and the noise exposure register (AT § 65 Abs. 4 ASchG / VOLV). Both go to P10.
- The full H/P statement catalogue, SDS PDF extraction, limit values per substance (separate exposure-limit catalogue pass), and Switzerland.

---

## 5. Build instructions for CC (slices, commit + push after each, tests green)
1. **Schema + CLP reference.** Enums first, then models per §2, RLS, CHECKs (exactly-one subject, statement formats). Seed GHS01–09 + signal words with labels. Pictogram assets.
2. **Register UI.** Gefahrstoffe → Verzeichnis (list, filters by site/CMR/pictogram/substitution status), substance detail (classification, statements, SDS versions, uses, linked findings), SDS upload via the document layer, and alerts from §3.5.
3. **Training derivation.** Activate the `SUBSTANCE` source and `retentionOverride` (incl. the CMR pre-fill), plus tests.
4. **Betriebsanweisung generator** per §3.2: draft → approve → archive, review flag on a new SDS revision. Seed the §3.2 legal rows (`seed-check`: read the Stand at seed, skip and report if unreadable).
5. **Register document** per §3.3 (DE Gefahrstoffverzeichnis, AT Arbeitsstoffliste), country-gated, fail-closed for CH.
6. **Retention rows** per §3.4 (catalogue `v2-2026-11`), new record types and trigger, wire SDS/SubstanceUse into the anonymisation/retention job as *deletion candidates after the period* (these are not person data: they are proposed for deletion with company_admin approval, same batch flow).
7. **Demo fixture:** AT and DE demo sites with ~8 substances (incl. one CMR 1B, one low-hazard excluded), SDS uploads, uses at workstations, one approved Betriebsanweisung each.
8. **Verify.** Unit tests (CHECKs, alerts, derivation, retention), German HTTP walkthrough on AT and DE, render and text-check both register PDFs and one Betriebsanweisung PDF. Update CLAUDE.md status. Then continue with **P9 (Begehungen & Audits)**.
