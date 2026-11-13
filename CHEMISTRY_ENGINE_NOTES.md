# CHEMISTRY_ENGINE_NOTES.md

Review package for a chemistry expert (`SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md`
§3 / §6). For each prepared Phase 2/3 engine: what it implements, the source text,
known limits, open interpretation points, and what an expert must review before the
feature flag is turned on. Until then every engine ships **behind a flag that
defaults OFF** and produces nothing a customer can see; where the regulation is
ambiguous, the **conservative** reading is implemented and recorded here, and the
flag stays off (§0.2). No engine ever produces a number, classification or limit
value from model recollection (§0.7 / §7).

> Status: this file is created in S1 as the standing record. Each engine section is
> filled in when that engine is built (build order: §3 engines land after S1–S8).

## Recorded interpretation points (S1)
- **P-statements source location.** The plan's §2 S1 shorthand says the "H, P and
  EUH statements" come from "CLP Annex III". In the regulation, **Annex III** holds
  the H-statements (Part 1) and the supplemental EUH statements (Parts 2/3);
  **precautionary (P) statements are in Annex IV.** The importer records the correct
  per-statement `sourceRef` accordingly (Annex III for H/EUH, Annex IV for P). No
  behaviour change — a documentation-accuracy note so the `sourceRef` provenance is
  truthful.

## Recorded interpretation points (S3 — consistency checks)
- **Built (deterministic, structural):** signal-word ↔ hazard presence, GHS02 ↔
  flammable H22x code, aquatic H-code (H400/H410/H411/H412/H413) ↔ transport
  marine-pollutant flag, German-SDS-for-AT/DE (REACH Art. 31(5)), revision age,
  hazardous-but-no-components. These use only the regulation's fixed CODE
  identifiers, never a recalled threshold. All results are Prüfhinweise; the AI
  only explains them (`sds-consistency-ai.ts`), never changes them.
- **Deferred to the S1 catalogue (honest gaps, not guessed):**
  - The **full H ↔ pictogram ↔ signal-word** label-rule check needs
    `ClpLabelElementRule` (CLP Annex I/V) loaded; until then only the structural
    GHS02/flammable heuristic above runs.
  - The **flammable-liquid flash-point / boiling-point** consistency check
    (H224/H225/H226 vs. the numeric CLP Annex I criteria) is **not emitted** —
    the thresholds are regulatory numbers that must come from the official text,
    not recollection. The check is a silent gap until the criteria are imported.
  - The **harmonised-classification-missing** check (a component with an Annex VI
    entry whose stated classification omits a harmonised hazard) needs
    `ClpHarmonisedClassification` loaded; the hook exists, inert until then.

## Recorded interpretation points (S5 — storage, WGK, VbF)
- **Built now:** StorageLocation entity (S5a); the TRGS 510 Zusammenlagerungs-
  check (S5b, DE-gated, pure `checkZusammenlagerung`, honest gap when no matrix);
  Substance.lagerklasse + Substance.wgk set from the confirmed SDS (section 15);
  WGK + flash-point display on the substance page.
- **Pending official data (honest gaps, never guessed):**
  - **TRGS 510 compatibility matrix** — no rows seeded; DE sites show "keine
    Zusammenlagerungsregel hinterlegt" until the matrix is imported (founder/
    official step). AT/CH have no scheme (fail-closed).
  - **UBA Rigoletto substance-WGK import** — not built; WGK shows the supplier-
    declared value from the SDS (or manual). The own mixture WGK calculation is
    Phase 2 (`wgk.mixtureCalculation`, flag OFF).
  - **AT VbF flash-point classification** — the VbF class thresholds are
    regulatory numbers (RIS), not seeded; the substance page shows the SDS flash
    point with an explicit "no VbF thresholds loaded" note. Display only; the
    VbF storage-quantity rules are referenced, not computed (§2 S5).

## Recorded interpretation points (S6 — reference data)
- **Built with real data:** PubChem is reachable and public-domain (unlike the
  blocked EUR-Lex/RIS/TRGS sources), so S6 imports actual reference data.
  `reference-substance.ts` fetches CID + molecular formula + IUPAC name (PUG REST)
  and the experimental physical properties (PUG View) stored **verbatim as text**
  (never numerically re-parsed, §0.7), each with its PubChem source name. A value
  without a resolvable source is **skipped** (the "public-domain / skip depositor-
  restricted" rule). Shown as "Referenzdaten" next to a substance, matched by CAS,
  alongside — never replacing — the SDS values. Demo substances (Acetone,
  Isopropanol, NaOH, Trichloroethylene) imported live (13–36 values each).
  ReferenceSubstance is global/system, so a demo reset does not delete it.

## Prepared engines (to be filled in when built — §3)
### `clp.mixtureCalculation` — FRAMEWORK BUILT (flag OFF), `engines/clp-mixture.ts`
Implements the **method arithmetic** only; the regulatory **thresholds** (generic
concentration limits, summation cut-offs, M-factors) are **passed in as config**,
never recalled (§0.7/§7).
- **`computeAteMix`** — the CLP Annex I additivity formula `100/ATE_mix = Σ(C_i/ATE_i)`.
  Pure arithmetic, fully tested (e.g. 20%@500 + 80%@5000 → 1785.7). Reports the
  unknown-ATE fraction; the "≥10% unknown" rule is regulatory and left to the
  config/expert.
- **`summationMethod`** — `Σ(concentration × multiplier) ≥ cut-off`; the cut-off
  and multipliers come from the CLP config. Tested with fixture thresholds.
- **PENDING before the flag goes on (expert + official data):** load the real
  CLP Annex I generic concentration limits / summation cut-offs / M-factor table,
  then reproduce ECHA's CLP-guidance worked examples against them (the official
  text is bot-blocked in the build env — a founder/official-source step).
  **Physical hazards are not calculated** (need test data, §3). Open points: the
  unknown-ATE handling, SCL vs. GCL precedence, and the aquatic chronic summation
  tiers — all to confirm against the guidance.

### `mixture.physicalEstimates` — BUILT (flag OFF), `engines/physical-estimates.ts`
Pure physics (no regulatory thresholds), so buildable and fixture-tested now.
- **Density:** mass-weighted ideal mixing, `1/ρ_mix = Σ(w_i/ρ_i)`. **Interpretation
  / conservative choice:** assumes ideal mixing (no excess volume); real mixtures
  (e.g. ethanol/water) show volume contraction, so the estimate can differ by a
  few %. Labelled *Näherungswert, nicht für Einstufung*. Refuses when any
  component lacks a density or the mass fractions don't sum to ~1.
- **Boiling-range lower bound:** the lowest component boiling point (a mixture
  boils no lower than its most volatile component under this simplification).
- **Flash point:** the lowest component flash point — the **conservative** bound.
  The Raoult/Le Chatelier partial-pressure refinement needs vapour-pressure data
  (S6) and is **deferred**; the conservative min-bound is used meanwhile.
- **Expert review before the flag is turned on:** confirm the ideal-mixing
  caveat is acceptable for the intended use, and decide whether the Raoult
  flash-point model is required (it is more accurate but needs reliable
  component vapour-pressure/Antoine data). Output is never for classification.

### `wgk.mixtureCalculation` — FRAMEWORK BUILT (flag OFF), `engines/wgk-mixture.ts`
`computeMixtureWgk(components, rules)` — the AwSV **presence-threshold** framework:
the mixture takes the highest WGK class whose summed component concentration meets
its threshold. The threshold percentages are **passed in** (loaded from the
official AwSV text), never recalled. Fixture-tested. **PENDING:** the full AwSV
**additive** rule with its weighting factors (the presence-threshold version is a
conservative simplification), and the real thresholds — both an official-text +
expert step. Result is a *Berechnungsvorschlag*.

### `transport.classification`
_Not yet built._ Data model for UN entries + derivation from classification. **No
dangerous-goods list imported** (ADR has no official machine-readable list; IMDG/
IATA are licensed). Hand-built fixture list only.

### `sds.authoring`
_Not yet built._ 16-section SDS schema per REACH Annex II (2020/878) + mapping +
draft render. No phrase catalogue (EuPhraC licensed); free text only. Never offered
while OFF.

### `storage.lagerklasseSuggestion` — FRAMEWORK BUILT (flag OFF), `engines/lagerklasse-suggestion.ts`
`suggestLagerklasse(input, scheme)` — evaluates a priority-ordered rule list
(H-codes / flammable pictogram → Lagerklasse) and returns the first match. The
**scheme is passed in** (loaded from the official TRGS 510 decision scheme),
never recalled; an empty scheme yields no suggestion. Fixture-tested with an
illustrative (non-official) scheme. **PENDING:** load the real TRGS 510 decision
scheme and confirm the rule ordering with an expert. Suggestion only — the
Phase-1 storage check (S5b) never computes a Lagerklasse.
