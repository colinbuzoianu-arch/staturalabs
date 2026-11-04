# SLD_P8_GEFAHRSTOFFE_DRAFT — Gefahrstoffe (for founder verification)

**Status: DRAFT — awaiting founder sign-off. No schema, migration, seed or UI yet.**

Per `SLD_RESTRUCTURE_PLAN_platform-modules.md` §7.5 and the §11 gate ("For every legal reference, deadline, retention period or limit, draft the catalogue rows with official source links … and stop for my verification before seeding or writing UI text"). P8 also consumes two hooks from `SLD_P7B_DEFERRALS_RESOLVED.md`: the reserved `SUBSTANCE` requirement source (A.2) and a per-`TrainingRequirementType` retention override (C.2).

Everything in §3 below (legal references, document templates, retention periods, CLP reference data) is **proposed by Claude and must be verified by the founder before it is seeded or its text written**. Nothing legal is treated as confirmed here.

---

## 1. Scope (plan §7.5)

- `Substance` register (trade name, manufacturer, CAS/EC, CLP classification as structured fields), `SafetyDataSheet` (SDS versions, revision date, language, supplier; age + missing-language alerts), `SubstanceUse` (site + subject, purpose, quantity class, storage location, exposure route).
- Operating-instruction generator (**Betriebsanweisung**, per-country template).
- The country's **substance register document** (Gefahrstoffverzeichnis).
- Substitution-check field; links to `CHEMICAL` findings, environmental aspects, waste streams.
- Optional later: SDS PDF data extraction with human confirmation.

**Not person data.** The substance chain is person-free (it describes substances and workplaces). Where it touches people it does so only through the existing people compartment — e.g. a **substance exposure record** per person is person data and would live in the people compartment behind its own retention rule (§3.4 below), not on the substance.

---

## 2. Proposed schema (not built)

All FKs `Restrict`, RLS on, enum-first migrations, country-gated documents fail-closed like the SGD/AWK.

- **`Substance`** — `companyId?` (null = system/reference), `tradeName`, `manufacturer?`, `casNumber?`, `ecNumber?`, `physicalState` enum, `signalWord` enum (`DANGER`/`WARNING`/none), `substitutionCheckNote?`, `isCmr` (carcinogenic/mutagenic/reprotoxic flag — drives retention, §3.4).
- **`SubstancePictogram`** — join `substanceId` + `GhsPictogram` enum (GHS01–GHS09). (CLP, §3.1.)
- **`SubstanceHazardStatement`** — `substanceId` + `code` (e.g. "H350") + free text. (We store the codes the company enters; we do **not** ship the full EU H/P catalogue in v1 — §3.1.)
- **`SafetyDataSheet`** — `substanceId`, `version`, `revisionDate`, `language`, `supplier?`, `storagePath` (uploaded PDF via the P4 document pipeline + malware scan), `supersededAt?`. Age + missing-language alerts computed on read.
- **`SubstanceUse`** — `substanceId` + exactly one subject (workstation/process/org-unit, loose `subjectType`+`subjectId` like the training sources — keeps it FK-free into the assessment chain), `purpose`, `quantityClass` enum, `storageLocation?`, `exposureRoute` enum.
- **Wiring:** `TrainingRequirementSource.subjectType = SUBSTANCE` becomes derivable (a substance with uses at a workstation → instruction required for assigned persons); `TrainingRequirementType.retentionOverride?` (the C.2 per-type override) so substance instructions can carry the long CMR retention; the substance register document is a new country-gated generator.

---

## 3. Legal / template content to VERIFY before seeding

### 3.1 CLP reference data (EU-wide, factual)
- **GHS pictograms** GHS01–GHS09 and **signal words** (Gefahr/Danger, Achtung/Warning) are EU CLP Regulation (EC) No 1272/2008 — stable, factual. **Proposal:** seed the 9 pictogram codes + 2 signal words as an enum/reference (no per-row legal risk).
- **H/P statements:** the full Annex III/IV catalogue is large and periodically amended. **Proposal:** do NOT ship it in v1; the assessor enters the H/P codes present on the SDS. (A verified H/P catalogue can come later.) — **confirm this scope.**

### 3.2 Betriebsanweisung template (country-specific — VERIFY)
Operating instruction for a hazardous substance. Proposed section structure (to confirm): (1) Anwendungsbereich, (2) Gefahrstoffbezeichnung, (3) Gefahren für Mensch und Umwelt, (4) Schutzmaßnahmen und Verhaltensregeln, (5) Verhalten im Gefahrenfall, (6) Erste Hilfe, (7) Sachgerechte Entsorgung.
- **DE legal basis (proposed):** §14 GefStoffV (Unterweisung + Betriebsanweisung). **VERIFY** the current §/version — the GefStoffV was renumbered in the 2 Dec 2024 version.
- **AT legal basis (proposed):** GKV 2011 (Grenzwerteverordnung) / §§ ASchG on Unterweisung + the Betriebsanweisung practice. **VERIFY** the exact AT anchor.
- German-only, country-gated (AT/DE), same fail-closed gate as the SGD.

### 3.3 Gefahrstoffverzeichnis (substance register document — VERIFY)
A per-site register of hazardous substances in use. **DE (proposed):** §6 Abs. 12 GefStoffV (Verzeichnis der Gefahrstoffe) — name, classification, quantity ranges, work areas. **AT (proposed):** the equivalent ASchG/GKV inventory duty. **VERIFY** both anchors + required columns.

### 3.4 RetentionRule rows for SDS + exposure (the important one — VERIFY)
New `RetentionRecordType` values `SDS` and `SUBSTANCE_EXPOSURE`, with these proposed rows (to verify before seeding):

| country | recordType | basis | minRetention | proposed source (VERIFY) |
|---|---|---|---|---|
| DE | SUBSTANCE_EXPOSURE (CMR 1A/1B) | STATUTORY | **40 years** after exposure ends | §10a GefStoffV (2024; formerly §14(3)); DGUV IFA exposure-register guidance |
| DE | SUBSTANCE_EXPOSURE (reprotoxic 1A/1B) | STATUTORY | **≥5 years** | §10a GefStoffV / TRGS 410 |
| AT | SUBSTANCE_EXPOSURE (CMR) | STATUTORY | **40 years** (proposed, to verify) | GKV / VbA — **AT anchor to confirm** |
| AT, DE | SDS | POLICY_DEFAULT | kept while in use + a policy tail | company policy (SDS currency is an operational, not retention, duty) |

- The 40-year CMR exposure record is a real statutory obligation (DE); the exposure record itself is **person data** → it lives in the people compartment behind `health_data`-adjacent handling, and this is the point where P8 and the P10 health sub-compartment meet. **Decision to confirm:** does the exposure record land in P8, or is it deferred to P10 with the health compartment? (I recommend: P8 ships the substance/SDS/use register now; the per-person **exposure record** + its 40-year rule lands with P10, since it is person+health data. P8 only adds the SDS retention row + the reserved record types.)

---

## 4. What I need from you

1. §3.1 — seed GHS pictograms + signal words; **don't** ship the full H/P catalogue in v1? (confirm)
2. §3.2 — confirm the Betriebsanweisung section structure + the **DE §14→§10a?** and **AT** legal anchors.
3. §3.3 — confirm the Gefahrstoffverzeichnis legal anchors + columns for AT and DE.
4. §3.4 — confirm the retention periods/sources, and the **P8-vs-P10 boundary for the per-person exposure record** (my recommendation: exposure record → P10).
5. §2 — confirm the schema shape (esp. loose `SubstanceUse` subject link + the `TrainingRequirementType.retentionOverride`).

On your verified answers I'll build P8 in slices (substance + SDS register + uses → operating-instruction generator → substance register document → requirement-source derivation + retention), each green and verified, country-gated, with only the approved legal text.

Sources consulted for the retention anchor (to be re-verified by the founder):
- DGUV IFA — Expositionsverzeichnis (40-year retention): https://www.dguv.de/ifa/praxishilfen/taetigkeiten-mit-krebserzeugenden-gefahrstoffen/gefaehrdungsbeurteilung/expositionsverzeichnis/index.jsp
- GefStoffV §10a (2024 renumbering): https://lxgesetze.de/gefstoffv/10a
- TRGS 410 (exposure register): https://www.umwelt-online.de/recht/t_regeln/trgs/trgs400/410_a.htm
