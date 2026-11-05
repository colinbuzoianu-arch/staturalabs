# SLD P11 — Rechtskataster legal-requirements catalogue: founder-approved (v1)

**Approved by:** Colin Buzoianu (founder), 2026-11-05. Delegated desk research and review by Claude, accepted by the founder, against the official portals (ris.bka.gv.at, gesetze-im-internet.de) and consolidated mirrors cited per row. `verificationMethod` per row as in P3/P8/P10: `official` (Stand read on the official portal), `mirror` (consolidated mirror / official authority publication), `seed-check` (CC reads the identifier + Stand on the official page at seed, and **skips the row if unreadable** — never seeds a blank or guessed value).

Replaces `SLD_P11_LEGAL_REQUIREMENTS_DRAFT.md`. This is a **v1 core register**, not an exhaustive body of law: a defensible starting set across OSH and environment for AT and DE, that a customer's EHS lead extends per site. CH stays positioning-only. Seed only §2 and §3. Everything in §5 is deferred with a reason. The fail-closed, no-cross-country-borrow rule (ERGO §3.15) holds: a site's country with no row for a topic shows an honest gap, never another country's row.

**Scope discipline (important):** each row is SLD's own short statement of *what the obligation is about* plus a pointer to the official source — **not** a reproduction of statute text and **not** legal advice. The obligation wording is a label for the register, nothing more. The authoritative text is always the linked source.

---

## 1. Model (person-free structural spine — CC builds this autonomously, no gate)

- **`LegalRequirement`** (`companyId?` null = system/reference catalogue; set = a company's own addition), versioned via `LegalRequirementCatalogVersion` (single active, fail-closed, pattern: `ExposureLimitCatalogVersion`). Fields: `country`, `domain` (`OSH` | `ENVIRONMENT`), `code`, `title`, `obligationSummary` (our wording), `legalReferenceId` (into the P3 `LegalReference` catalogue — reuse existing rows where they exist, add the new ones in §4), `applicability` (structured criteria, §1.1), `defaultReviewInterval` (ISO-8601; default **P1Y**), `notes?`.
- **`SiteLegalRequirement`** (the per-site applicability join): `siteId`, `legalRequirementId`, `status` (`APPLICABLE` | `NOT_APPLICABLE` | `OPEN`), `rationale?` (required for `NOT_APPLICABLE`, CHECK like `HazardCategoryCheck`), `assignedByUserId`, `assignedAt`. Suggested from `applicability` against the site's attributes/active modules, **confirmed by a human** (never inferred — same discipline as hazard-category completeness).
- **`ComplianceEvaluation`** (the state machine): `siteLegalRequirementId`, `state` (`NOT_EVALUATED` → `COMPLIANT` | `PARTIALLY_COMPLIANT` | `NON_COMPLIANT` | `NOT_APPLICABLE`), `evaluatedByUserId`, `evaluatedAt`, `evidence` (links to documents/actions/assessments via the P4 document layer), `note?`, `nextReviewDue`. Append-only `ComplianceEvaluationEvent` history. A `NON_COMPLIANT` or `PARTIALLY_COMPLIANT` evaluation can raise an `Action` (the one action engine).
- **Change log:** when a new catalogue version changes or retires a requirement, each affected `SiteLegalRequirement` is flagged "Überprüfung erforderlich" with a diff of what changed. No person data anywhere in this module.

### 1.1 `applicability` criteria (drive the per-site suggestion)
A small structured set, all derived from existing site/module data, never from a person: `domainActive` (OSH / ENVIRONMENT module entitled), `hasHazardCategory` (e.g. CHEMICAL, NOISE), `usesSubstances`, `hasWasteStreams`, `employeeCountBand` (from the site's own figure, a count — not person records), `country`. A requirement with unmet criteria is suggested as `NOT_APPLICABLE` with a pre-filled rationale the human confirms.

---

## 2. OSH requirements — seed these

Rows marked **(reuse)** already exist as `LegalReference` rows from P3/P8/P10 — point `legalReferenceId` at the existing row, don't duplicate it. Rows marked **(new)** need a `LegalReference` row from §4.

### AT — OSH

| code | title | obligationSummary | legalReference | applicability | method |
|---|---|---|---|---|---|
| AT-OSH-01 | Arbeitsplatzevaluierung | Gefahren ermitteln, beurteilen und Maßnahmen festlegen | AT-1 ASchG §4 (reuse) | OSH active | mirror |
| AT-OSH-02 | Sicherheits- und Gesundheitsschutzdokumente | Ergebnisse der Evaluierung dokumentieren | AT-2 ASchG §5 + AT-3 DOK-VO (reuse) | OSH active | official |
| AT-OSH-03 | Unterweisung | Arbeitnehmer nachweislich unterweisen | AT-4 ASchG §14 (reuse) | OSH active | mirror |
| AT-OSH-04 | Präventivdienste | Sicherheitsfachkräfte und Arbeitsmediziner bestellen | AT-5 ASchG §§73 ff. (reuse) | OSH active | mirror |
| AT-OSH-05 | Arbeitsstätten | Anforderungen an Arbeitsstätten einhalten | AT-6 AStV (reuse) | OSH active | seed-check |
| AT-OSH-06 | Arbeitsmittel | Schutz bei der Benutzung von Arbeitsmitteln | AT-7 AM-VO (reuse) | OSH active | seed-check |
| AT-OSH-07 | Persönliche Schutzausrüstung | Auswahl, Bereitstellung und Benutzung von PSA | AT-PSA (deferred in P3) | OSH active + PPE used | seed-check |
| AT-OSH-08 | Verzeichnis exponierter Arbeitnehmer | Verzeichnis bei krebserzeugenden/mutagenen/repro­toxischen oder biologischen Arbeitsstoffen führen; Übermittlung an den UV-Träger | AT-EXP ASchG §47 (reuse, from P8) | OSH active + CMR/biological substances | mirror |
| AT-OSH-09 | Grenzwerte für Arbeitsstoffe | Grenzwerte (GKV) einhalten und Exposition ermitteln | AT-GKV (new) | OSH active + substances | seed-check |
| AT-OSH-10 | Unfallmeldung | Arbeitsunfälle und Berufskrankheitsverdacht melden | AT-N1 ASVG §363 (reuse, from P10) | OSH active | mirror |
| AT-OSH-11 | Aufzeichnung von Arbeitsunfällen | Aufzeichnungen über Arbeitsunfälle führen (≥5 Jahre) | AT-ACC ASchG §16 (reuse, from P10 retention) | OSH active | mirror |
| AT-OSH-12 | Lärm und Vibrationen | Gefährdung durch Lärm/Vibrationen ermitteln, Grenzwerte beachten | AT-VOLV (new) | OSH active + NOISE/VIBRATION | seed-check |
| AT-OSH-13 | Bildschirmarbeit | Anforderungen an Bildschirmarbeitsplätze | AT-BSV (new) | OSH active + office/screen work | seed-check |

### DE — OSH

| code | title | obligationSummary | legalReference | applicability | method |
|---|---|---|---|---|---|
| DE-OSH-01 | Gefährdungsbeurteilung | Arbeitsbedingungen beurteilen, Maßnahmen ableiten | DE-1 ArbSchG §5 (reuse) | OSH active | official |
| DE-OSH-02 | Dokumentation | Gefährdungsbeurteilung dokumentieren | DE-2 ArbSchG §6 (reuse) | OSH active | official |
| DE-OSH-03 | Psychische Belastung | Psychische Belastung in die Beurteilung einbeziehen | DE-3 ArbSchG §5 Abs. 3 Nr. 6 (reuse) | OSH active | official |
| DE-OSH-04 | Unterweisung | Beschäftigte unterweisen | DE-4 ArbSchG §12 (reuse) | OSH active | official |
| DE-OSH-05 | Betriebsärzte / Fachkräfte | Betriebsärzte und Fachkräfte für Arbeitssicherheit bestellen | DE-7 ASiG (reuse) + DGUV V2 | OSH active | seed-check |
| DE-OSH-06 | Arbeitsstätten | ArbStättV (+ ASR) einhalten | DE-8 ArbStättV (reuse) | OSH active | official |
| DE-OSH-07 | Betriebssicherheit (Arbeitsmittel) | Gefährdungsbeurteilung und Schutzmaßnahmen bei Arbeitsmitteln | DE-9 BetrSichV (reuse) | OSH active | official |
| DE-OSH-08 | Lärm und Vibrationen | Gefährdung durch Lärm/Vibrationen beurteilen | DE-10 LärmVibrationsArbSchV (reuse) | OSH active + NOISE/VIBRATION | official |
| DE-OSH-09 | Persönliche Schutzausrüstung | Auswahl, Bereitstellung, Benutzung und Unterweisung PSA | DE-11 PSA-BV (reuse) | OSH active + PPE used | official |
| DE-OSH-10 | Gefahrstoffe | Gefahrstoffverzeichnis, Betriebsanweisung, Schutzmaßnahmen | GS-DE-1 GefStoffV §14 + GefStoffV §6 Abs. 12 (reuse, from P8) | OSH active + substances | seed-check |
| DE-OSH-11 | Expositionsverzeichnis CMR/repro | Expositionsverzeichnis führen (40 J. CMR 1A/1B; 5 J. repro) | DE-EXP GefStoffV §10a (reuse/new, from P8) | OSH active + CMR/repro substances | seed-check |
| DE-OSH-12 | Arbeitsmedizinische Vorsorge | Vorsorge nach ArbMedVV anbieten/veranlassen, Vorsorgekartei führen | DE-ARBMEDVV (new) | OSH active | seed-check |
| DE-OSH-13 | Biologische Arbeitsstoffe | Schutzmaßnahmen nach BioStoffV | DE-BIOSTOFFV (new) | OSH active + BIOLOGICAL | seed-check |
| DE-OSH-14 | Unfallanzeige | Arbeitsunfälle / Berufskrankheitsverdacht anzeigen | DE-N1 SGB VII §193 (reuse, from P10) | OSH active | seed-check |
| DE-OSH-15 | Erste Hilfe | Erste-Hilfe-Organisation und Dokumentation (Verbandbuch) | DE-FA DGUV V1 §24 (reuse, from P10 retention) | OSH active | mirror |

---

## 3. Environment requirements — seed these

### AT — ENVIRONMENT

| code | title | obligationSummary | legalReference | applicability | method |
|---|---|---|---|---|---|
| AT-ENV-01 | Abfallwirtschaftskonzept | AWK ab >20 Arbeitnehmern erstellen und fortschreiben | AT-AWK AWG 2002 §10 (reuse, from E4) | ENV active + employeeCountBand >20 | mirror |
| AT-ENV-02 | Abfallbeauftragter | Abfallbeauftragten bestellen, wo erforderlich | AT-AWG-ABF AWG 2002 §11 (new) | ENV active + employeeCountBand threshold | seed-check |
| AT-ENV-03 | Abfallnachweise / Aufzeichnungen | Aufzeichnungen und Nachweise über Abfälle führen | AT-AWG-REG AWG 2002 §17 (new) | ENV active + hasWasteStreams | seed-check |
| AT-ENV-04 | Gewässerschutz / Abwasser | Einleitungen und Umgang mit wassergefährdenden Stoffen nach WRG 1959 | AT-WRG (new) | ENV active + water discharge / hazardous storage | seed-check |
| AT-ENV-05 | Anlagengenehmigung Luft/Emissionen | Emissions-/Anlagenpflichten (z. B. EG-K, GewO-Anlagenrecht) | AT-EMI (new) | ENV active + regulated installation | seed-check |

### DE — ENVIRONMENT

| code | title | obligationSummary | legalReference | applicability | method |
|---|---|---|---|---|---|
| DE-ENV-01 | Kreislaufwirtschaft / Abfall | Pflichten zur Abfallvermeidung und -bewirtschaftung | DE-KRWG KrWG (new) | ENV active + hasWasteStreams | official |
| DE-ENV-02 | Betriebsbeauftragter für Abfall | Abfallbeauftragten bestellen, wo erforderlich | DE-ABFBEAUFTV (new) | ENV active + threshold | seed-check |
| DE-ENV-03 | Gewerbeabfall | Getrennthaltung/Dokumentation nach GewAbfV | DE-GEWABFV (new) | ENV active + commercial waste | seed-check |
| DE-ENV-04 | Immissionsschutz | Pflichten für genehmigungsbedürftige/nicht genehmigungsbedürftige Anlagen | DE-BIMSCHG BImSchG (new) | ENV active + regulated installation | official |
| DE-ENV-05 | Wasserhaushalt / wassergefährdende Stoffe | Umgang mit wassergefährdenden Stoffen (WHG / AwSV) | DE-WHG WHG (new) | ENV active + hazardous storage / discharge | official |

---

## 4. New `LegalReference` rows to seed (into the P3 catalogue) before §2/§3

Reuse existing P3/P8/P10 rows for everything not listed here. These are the genuinely new references:

| code | country | reference | sourceUrl | method |
|---|---|---|---|---|
| AT-GKV | AT | Grenzwerteverordnung (GKV) | ris.bka.gv.at — Gesamte Rechtsvorschrift GKV; CC resolves the current Gesetzesnummer at seed | seed-check |
| AT-VOLV | AT | Verordnung Lärm und Vibrationen (VOLV) | ris.bka.gv.at — GeltendeFassung VOLV | seed-check |
| AT-BSV | AT | Bildschirmarbeitsverordnung (BS-V) | ris.bka.gv.at — GeltendeFassung BS-V | seed-check |
| AT-AWG-ABF | AT | AWG 2002 §11 (Abfallbeauftragter) | https://www.ris.bka.gv.at/eli/bgbl/i/2002/102 (Gesetzesnummer **20002086**) | mirror |
| AT-AWG-REG | AT | AWG 2002 §17 (Aufzeichnungs-/Nachweispflichten) | Gesetzesnummer 20002086 | mirror |
| AT-WRG | AT | Wasserrechtsgesetz 1959 (WRG 1959) | ris.bka.gv.at — WRG 1959; CC resolves Gesetzesnummer at seed | seed-check |
| AT-EMI | AT | Emissions-/Anlagenrecht (EG-K 2013 / GewO-Anlagenrecht) | ris.bka.gv.at; confirm which anchor fits the site's installation type | seed-check |
| DE-ARBMEDVV | DE | Verordnung zur arbeitsmedizinischen Vorsorge (ArbMedVV) | https://www.gesetze-im-internet.de/arbmedvv/ | seed-check |
| DE-BIOSTOFFV | DE | Biostoffverordnung (BioStoffV) | https://www.gesetze-im-internet.de/biostoffv_2013/ | seed-check |
| DE-EXP | DE | GefStoffV §10a (Expositionsverzeichnis) | https://www.gesetze-im-internet.de/gefstoffv_2010/__10a.html | seed-check |
| DE-KRWG | DE | Kreislaufwirtschaftsgesetz (KrWG) | https://www.gesetze-im-internet.de/krwg/ | official |
| DE-ABFBEAUFTV | DE | Verordnung über Betriebsbeauftragte für Abfall (AbfBeauftrV) | https://www.gesetze-im-internet.de/abfbeauftrv/ | seed-check |
| DE-GEWABFV | DE | Gewerbeabfallverordnung (GewAbfV) | https://www.gesetze-im-internet.de/gewabfv_2017/ | seed-check |
| DE-BIMSCHG | DE | Bundes-Immissionsschutzgesetz (BImSchG) | https://www.gesetze-im-internet.de/bimschg/ | official |
| DE-WHG | DE | Wasserhaushaltsgesetz (WHG) | https://www.gesetze-im-internet.de/whg_2009/ | official |

CC reads the current "Stand/Fassung" for each `official`/`seed-check` row at seed and records it as `consolidatedVersion`; skip and report any `seed-check` row whose official page can't be read. `verifiedBy = "Colin Buzoianu"`, `verifiedAt = 2026-11-05`.

---

## 5. Deferred (do not seed; flagged with a reason)

- **CH entirely.** VUV, ArG/ArGV 3, EKAS 6508, USG, GSchG (water), VVEA (waste). CH stays positioning-only until its pass; a CH site's Rechtskataster shows the honest gap.
- **AT fatal-accident Arbeitsinspektorat notification** — carried from P10, still needs the ArbIG anchor.
- **Working-time, maternity, young-workers law** (AZG/KJBG in AT; ArbZG/MuSchG/JArbSchG in DE). Real obligations, but they touch person data and scheduling that SLD doesn't model yet; add when/if a time or personnel module exists.
- **Sector-specific and installation-specific law** (construction site ordinance, pressure equipment, explosion protection beyond the hazard row, F-gas, energy): out of the v1 core; a company adds these as its own `companyId`-scoped `LegalRequirement` rows.
- **Land-level (Bundesland / Kanton) law:** out of v1; the model already allows company additions for it.

---

## 6. Build instructions (slices, commit + push after each, tests green)
1. **Spine first (no gate):** `LegalRequirementCatalogVersion`, `LegalRequirement`, `SiteLegalRequirement` (status CHECK: rationale required for `NOT_APPLICABLE`), `ComplianceEvaluation` + append-only `ComplianceEvaluationEvent`, the change-log flagging. Enum-first migrations, RLS, `Restrict` FKs, person-free (extend the schema test: no relation from this module into the people compartment). Pure `suggestApplicability(site, requirement)` with unit tests.
2. **Legal rows (§4)** into the P3 catalogue; `seed-check` discipline (read Stand, skip + report if unreadable).
3. **Catalogue seed (§2/§3)** under `v1-dach-2026`, system rows (`companyId` null), reusing existing `LegalReference` rows by code.
4. **UI:** Rechtskataster module — per-site requirement list (filter by domain/status), applicability review (suggested → human-confirmed), compliance evaluation with evidence links and the state machine, review-due list feeding notifications, change-log view. Raising an `Action` from a non-compliant evaluation uses the one action engine. DE/EN, RO fallback to EN.
5. **Demo fixture:** AT and DE demo sites each with the applicable subset auto-suggested, a couple of `COMPLIANT`/`NON_COMPLIANT` evaluations with evidence, one requirement overdue for review, and a CH site showing the honest gap.
6. **Verify.** tsc/Biome/Vitest green; schema test proving no person link; German HTTP walkthrough on AT and DE (suggest applicability, evaluate one requirement, raise an action from a non-compliant one, see the review-due entry); CH gap shown. Update CLAUDE.md status; remove the P11 gate from the deferral list. Then continue with **P12 (Auswertungen & KPIs)**.

---

## 7. One honest caveat for the founder
This v1 is a credible core an EHS professional will recognise, and every row points to the real source. It is **not** a complete legal cadastre — no SaaS ships that out of the box, and claiming completeness would be the kind of legal over-promise your own compliance rules forbid. Position it to customers as "a maintained core catalogue you extend for your site", with the per-site `NOT_APPLICABLE`/company-addition mechanics doing the tailoring. Before an AT or DE customer relies on it, the `seed-check` rows (the ones where CC resolves the identifier at seed) are worth one pass of your eyes on RIS / gesetze-im-internet, same ten-minute check as the earlier phases.
