# SLD P15 — Gefahrstoffe extended: SDS intelligence, limit values, storage, prepared calculation engines — founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-13. Builds on P8 (Gefahrstoffe register, SDS versions, Betriebsanweisung, Gefahrstoffverzeichnis). Same engineering rules as always: module registry, subject helper, one action engine, versioned catalogues, hand-written migrations, enum-first, RLS policies + non-owner role (P13), `Restrict` FKs, append-only history, `AuditEvent`, DE/EN/RO, tsc/Biome/Vitest green per commit, slice by slice with commit + push.

## 0. Founder decisions already made (do not ask again)

1. **No US content.** Do not build or import: NFPA 704, OSHA PEL, NIOSH REL, ACGIH TLV, US DOT/49 CFR, US HazCom. IATA is international, but its DGR is licensed: extract IATA fields from supplier SDS only (§2), no own IATA classification.
2. **No chemistry expert is available.** Therefore:
   - **Phase 1 (live)** contains only what needs no expert judgment: extraction, lookup, rule-table checks, display with source.
   - **Phase 2/3 (prepared, OFF)** — mixture classification, mixture physical estimates, own WGK mixture calculation, own transport classification, SDS authoring — are built as data model + engine + tests **behind feature flags that default OFF** (P13 §2.5 flag store). Nothing from them is shown to a customer until a founder enables it per tenant in the super-admin console. CC does **not** stop to ask about chemistry; where the regulation text is ambiguous, CC implements the conservative reading, documents it in `CHEMISTRY_ENGINE_NOTES.md`, and leaves the flag off.
3. **Data licensing rule (CC applies it, no founder question):** a source is imported only if its reuse terms clearly permit it (EU legislation, Austrian/German official legal texts and official technical rules published as official works, PubChem public-domain records). If terms are unclear or restrictive, store **only a reference link** and let customers enter the value manually. Record every source and the reuse basis in `DATA_SOURCES_AND_LICENSES.md`. Licensed sources (GESTIS international limit values, IMDG Code, IATA DGR, EuPhraC phrase catalogue) are **not** imported; the model is prepared so they can be plugged in once licensed.
4. **R- and S-phrases** are obsolete since 1 June 2015. Only a read-only legacy field for old SDS imports, never computed, never shown on new documents.
5. **CH stays positioning-only** (unchanged): CH data can be imported but stays hidden until the CH pack is verified.
6. **No in-page AI agent or chat assistant.** AI is used only inside fixed functions (SDS extraction, hint explanations, Betriebsanweisung drafts), never as a free conversational agent in the app.
7. **Every computed or extracted value carries provenance** (source document, version/date, page or row, method) and every computed result is labelled *Prüfhinweis* or *Berechnungsvorschlag — Prüfung durch Fachkundige erforderlich*. AI never produces a number, classification or limit value from its own knowledge.

## 1. New verification method for bulk reference data

Bulk catalogues (thousands of rows) can't be founder-checked row by row. Add `verificationMethod = official-import`:
- Imported **programmatically** from a named official publication (machine-readable file where available, otherwise the official PDF).
- Importer stores `sourceUrl`, document title, version/Stand, import date, and the row/table reference per value.
- **Automated reconciliation must pass** before a catalogue version can be activated: row counts vs. source, zero parse errors, CAS-number checksum valid, units from a whitelist, no duplicate keys.
- **If a source is only a PDF:** two independent extraction passes (deterministic parser and/or AI extraction) must produce identical values. Any row where they differ is excluded and listed in the import report, never guessed.
- After reconciliation passes, CC activates the version. It stays visible and deactivatable in the super-admin catalogue control (P13 §2.3) with its provenance.

Update `ERGO_COMPLIANCE_BY_DESIGN.md` §3.19 with this method (bump revision).

---

## 2. Phase 1 — live features

### S1 — Reference data (CLP)
- **H, P and EUH statements:** full catalogue with official DE and EN texts from CLP Annex III (consolidated text on EUR-Lex), `official-import`, versioned per CLP adaptation (ATP). Replaces the P8 free-text statement entry with a catalogue reference, while keeping the format validation for codes not yet in the catalogue.
- **Label element rules:** hazard class/category → pictogram and signal word per CLP Annex I/V tables, stored as data (not hard-coded), `official-import`.
- **Harmonised classifications (CLP Annex VI, Table 3):** import from EUR-Lex/ECHA, versioned per ATP. Used for lookups and checks, never to overwrite a supplier's data.
- **New hazard classes** added by Delegated Regulation (EU) 2023/707 (endocrine disruption, PBT/vPvB, PMT/vPvM; EUH380–EUH451): include their codes and texts; CC confirms the application dates from the official text.
- `LegalReference` rows (P3 catalogue, `seed-check`): CLP (EC) 1272/2008 consolidated; REACH Annex II as amended by (EU) 2020/878; Delegated Regulation (EU) 2023/707.

### S2 — SDS ingestion with AI (the main value)
Upload a supplier SDS (PDF). AI extracts into a **pre-filled review form**; nothing is saved until a user confirms.
- Fields:
  - **Section 1:** product identifier, UFI if present, supplier, emergency number.
  - **Header:** revision date, version, language.
  - **Section 2:** classification, pictograms, signal word, H/P/EUH codes.
  - **Section 3:** components (name, CAS, EC, concentration or range, component classification, SCLs, M-factors, ATEs where given).
  - **Section 8:** limit values the SDS cites.
  - **Section 9:** flash point, boiling point/range, density, vapour pressure, pH, physical state.
  - **Section 14:** UN number, proper shipping name, class, packing group, ADR/RID, IMDG, IATA fields, environmental hazard / marine pollutant flag.
  - **Section 15:** WGK, Lagerklasse (TRGS 510) if stated.
  - Legacy R/S phrases if present.
- **Every extracted field shows its evidence**: page number and the text snippet it came from. The user accepts, edits or rejects field by field. Confirmed data is stored with method `sds-extraction` and the confirming user.
- New SDS revision of a known product: show a field-level diff against the previous version (classification changed, new component, new H statement). Triggers the existing "Überprüfung erforderlich" on Betriebsanweisungen (P8).
- AI: Claude via the official Anthropic SDK, model set by environment variable, called server-side only, tenant-scoped. SDS are product documents, so no worker data. Supplier contact details are business contact data; keep them. Add Anthropic to the sub-processor list template and TOMs template (P13 §7).

### S3 — SDS consistency checks (deterministic rules; AI only explains)
Run on every confirmed SDS. Results are hints with a severity and a reason, never automatic corrections:
- H statement ↔ pictogram ↔ signal word consistent per the S1 label rules.
- Flammable liquid H224/H225/H226 consistent with the stated flash point and initial boiling point (CLP Annex I table for flammable liquids, from the official text).
- Environmental hazard: transport "environmentally hazardous / marine pollutant" flag consistent with aquatic hazard classification (hint level, since transport has its own criteria).
- Component with a harmonised classification (Annex VI) missing from the stated component classification.
- Formal checks: SDS in German for AT/DE sites (REACH Art. 31(5), already in P8), current Annex II format (2020/878), all 16 sections present, revision date and age alert (P8 policy).
- AI writes a plain-German explanation of each hint ("Das SDB nennt H225, aber der angegebene Flammpunkt von 35 °C passt zu H226 …"). The explanation can't change the result.

### S4 — Occupational exposure limits (DACH + EU)
New `SubstanceExposureLimit` catalogue, separate from the existing noise/vibration `ExposureLimit`:
- Fields: CAS/EC, substance name, jurisdiction (`AT` | `DE` | `CH` | `EU`), type (`MAK` | `TRK` | `AGW` | `IOELV` | `BOELV` | `CH_MAK` …), value, unit, averaging period (Tagesmittelwert / Kurzzeitwert, 8 h / 15 min), excursion factor where stated, notations (skin resorption, sensitising, carcinogenic category, pregnancy group), source row reference.
- Sources (`official-import`, licence rule from §0.3):
  - **AT:** GKV Anhang I (MAK and TRK values), current consolidated version on RIS.
  - **DE:** TRGS 900 (Arbeitsplatzgrenzwerte). Also TRGS 910 (Akzeptanz- und Toleranzkonzentrationen) where machine-importable; otherwise reference only.
  - **EU:** indicative and binding limit values from the OEL directives on EUR-Lex.
  - **CH:** Suva limit values, imported but hidden while CH is unverified; if reuse terms are unclear, reference only.
- Display on the substance and each component: "Grenzwert laut <Quelle, Stand>". For a site, show the site's own jurisdiction first. Never mix jurisdictions into one number. No cross-country fallback.
- Feeds the existing exposure measurement comparison where a measured concentration exists.
- **Prepared, not imported:** a `jurisdiction` field that accepts any country, so licensed international data (e.g. GESTIS) can be added later without a schema change.

### S5 — Water hazard class, storage and flammable liquids
- **WGK lookup (DE):** substance WGK from the UBA Rigoletto database (`official-import` if reuse is permitted, otherwise reference link + manual entry). For mixtures, show the WGK the supplier declares in SDS section 15. The own mixture calculation is prepared in Phase 2.
- **`StorageLocation` entity:** replaces the free-text `SubstanceUse.storageLocation` (migrate existing values). Fields: site, name, type (room, cabinet, outdoor area, tank).
- **TRGS 510 Zusammenlagerung (DE sites):**
  - Lagerklasse per product, from SDS section 15/7 (S2) or manual entry.
  - Compatibility matrix from TRGS 510 stored as versioned data (`official-import`, `seed-check` on the legal row).
  - Per storage location: list the Lagerklassen present and flag combinations that are not allowed or allowed only with conditions, with the table reference.
  - A suggested Lagerklasse from the classification is **not** computed in Phase 1 (judgment involved).
  - AT and CH sites: show "keine Zusammenlagerungsregel hinterlegt", fail-closed.
- **VbF (AT sites):** classify flammable liquids by flash point per the current Austrian VbF (CC confirms the version and thresholds from RIS, `seed-check`), using the SDS flash point. Display only; storage-quantity rules of the VbF are referenced, not computed.

### S6 — Raw-material property database
- **`ReferenceSubstance`** (CAS-keyed, system catalogue): names (DE/EN), CAS, EC, molecular formula, and physical properties with **one row per value per source** (flash point, boiling point, melting point, density, vapour pressure, water solubility), each with source, method and conditions (e.g. "closed cup", temperature).
- Sources:
  - PubChem experimental properties (public-domain records only; skip records with depositor restrictions).
  - Values confirmed from supplier SDS (S2) as company-scoped rows.
  - Annex VI identifiers (S1).
- Shown on components and substances as "Referenzdaten". Never silently replaces SDS values; differences are shown side by side.

### S7 — AI drafting for Betriebsanweisungen
Extend the P8 generator: AI drafts the free-text sections (Schutzmaßnahmen und Verhaltensregeln, Verhalten im Gefahrfall, Erste Hilfe, Sachgerechte Entsorgung) **only from the confirmed SDS sections** of that product (sections 4, 5, 6, 7, 8, 13) plus the P6 measure catalogue.
- Each drafted paragraph links to its SDS source section.
- The output stays a DRAFT until a user approves it (existing flow).
- No information from outside the SDS.

### S8 — Entitlement and cost control
- AI features (S2 extraction, S3 explanations, S7 drafting) form an unlockable feature "KI-Funktionen Gefahrstoffe" in the super-admin module matrix (P13 §2.2), default OFF for new tenants.
- Per-tenant usage counter (calls, tokens) visible in the super-admin console. Optional monthly cap per tenant; when it's reached, AI features pause and manual entry keeps working.

---

## 3. Phase 2/3 — prepared, flags OFF (no customer-visible output)

Build data model, engine and tests now. Every output carries a `PREPARED_ENGINE` marker and is visible only where the flag is enabled.

| Flag key | What is prepared | Done when |
|---|---|---|
| `clp.mixtureCalculation` | CLP Annex I calculation methods for mixtures: acute toxicity (ATE additivity formula), skin corrosion/irritation and eye damage (summation incl. SCLs), sensitisation, CMR (generic concentration limits), STOT, aspiration, aquatic acute/chronic (summation with M-factors). Physical hazards are **not** calculated (they need test data). Input: confirmed SDS section 3 composition + Annex VI data. Output: a proposed classification and label elements, compared with the supplier's classification ("Abweichung prüfen"). | Unit tests reproduce the worked examples in ECHA's CLP guidance; ambiguities documented in `CHEMISTRY_ENGINE_NOTES.md`. |
| `mixture.physicalEstimates` | Density (mass-weighted ideal mixing), boiling range lower bound, flash point estimate (Raoult/Le Chatelier-type model, needs vapour pressure data from S6). Always labelled *Näherungswert, nicht für Einstufung*. | Tests on documented binary/ternary examples; estimate refuses to compute when component data is missing. |
| `wgk.mixtureCalculation` | AwSV mixture rule for WGK from component WGKs and concentrations, implemented from the official AwSV text. | Tests from the rule text; result labelled *Berechnungsvorschlag*. |
| `transport.classification` | Data model for UN entries (UN number, name, class, packing group, labels, special provisions, tunnel code, limited/excepted quantities) and derivation logic from classification. **No dangerous-goods list is imported** (ADR text is public but has no official machine-readable list; IMDG and IATA are licensed). | Model + logic + tests with a small hand-built fixture list; ready to load a licensed or curated list. |
| `sds.authoring` | Schema for the 16 SDS sections per REACH Annex II (2020/878), mapping from substance/mixture data and the engines above, and a draft PDF layout. No phrase catalogue (EuPhraC is licensed); free text only. | Schema + mapping + draft render of a fixture product; never offered to customers while OFF. |
| `storage.lagerklasseSuggestion` | TRGS 510 decision scheme to suggest a Lagerklasse from classification. | Tests from the TRGS 510 scheme; suggestion only. |

Write `CHEMISTRY_ENGINE_NOTES.md`: for each engine, what it implements, the source text, known limits, the open interpretation points, and what an expert would need to review before the flag is turned on.

---

## 4. Explicitly out of scope
- All US content (§0.1).
- An in-page AI agent or chat assistant (§0.6).
- Own classification of physical hazards (needs tests).
- Importing licensed data (GESTIS international, IMDG, IATA DGR, EuPhraC) until licensed.
- Any automatic change to a supplier's SDS data, classification or label.
- Per-person exposure register (stays in the P8/P10 exposure-register track).

## 5. Build order (slices, commit + push after each, tests green)
1. **S1** reference data + legal rows + the `official-import` method (§1).
2. **S2** SDS ingestion with AI and review form (incl. revision diff).
3. **S3** consistency checks.
4. **S4** exposure limits (AT, DE, EU; CH hidden).
5. **S5** WGK lookup, `StorageLocation` migration, TRGS 510 matrix (DE), VbF display (AT).
6. **S6** reference substance database (PubChem + SDS values).
7. **S7** AI drafting for Betriebsanweisungen.
8. **S8** entitlement + usage metering.
9. **Phase 2/3 prepared engines** (§3), flags OFF, with `CHEMISTRY_ENGINE_NOTES.md`.
10. **Verify:**
    - German HTTP walkthrough on the AT and DE demo sites: upload a real-format SDS, confirm the extraction, see the hints, the limit values with sources, the storage check (DE), the VbF class (AT), and a drafted and approved Betriebsanweisung.
    - Prove the prepared engines are invisible with flags OFF.
    - Update CLAUDE.md status, `DATA_SOURCES_AND_LICENSES.md` and the P13 legal-pack templates (sub-processor list: Anthropic).

## 6. Note for later
When a chemistry expert joins or is contracted, `CHEMISTRY_ENGINE_NOTES.md` is their review package. Each prepared engine can then be validated and switched on per tenant without new architecture.
