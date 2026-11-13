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

## Prepared engines (to be filled in when built — §3)
### `clp.mixtureCalculation`
_Not yet built._ Will implement CLP Annex I mixture calculation methods (ATE
additivity, summation with SCLs/M-factors for skin/eye/sensitisation/aquatic,
generic concentration limits for CMR/STOT/aspiration). Physical hazards are **not**
calculated (they need test data). Expert review target: reproduce the worked
examples in ECHA's CLP guidance; list every ambiguity here before the flag goes on.

### `mixture.physicalEstimates`
_Not yet built._ Density (mass-weighted ideal mixing), boiling-range lower bound,
flash-point estimate (Raoult/Le Chatelier-type). Always labelled *Näherungswert,
nicht für Einstufung*. Refuses to compute when component data is missing.

### `wgk.mixtureCalculation`
_Not yet built._ AwSV mixture rule for WGK from component WGKs + concentrations.
Result labelled *Berechnungsvorschlag*.

### `transport.classification`
_Not yet built._ Data model for UN entries + derivation from classification. **No
dangerous-goods list imported** (ADR has no official machine-readable list; IMDG/
IATA are licensed). Hand-built fixture list only.

### `sds.authoring`
_Not yet built._ 16-section SDS schema per REACH Annex II (2020/878) + mapping +
draft render. No phrase catalogue (EuPhraC licensed); free text only. Never offered
while OFF.

### `storage.lagerklasseSuggestion`
_Not yet built._ TRGS 510 decision scheme to *suggest* a Lagerklasse from
classification. Suggestion only; the Phase-1 storage check (S5) never computes one.
