# DATA_SOURCES_AND_LICENSES.md

Living record of every external data source P15 (Gefahrstoffe extended) draws on,
the reuse basis that decides whether it may be **imported** or only **referenced**,
and its current status. Rule (`SLD_P15_GEFAHRSTOFFE_EXTENDED_APPROVED.md` §0.3):

> A source is imported only if its reuse terms clearly permit it (EU legislation,
> Austrian/German official legal texts and official technical rules published as
> official works, PubChem public-domain records). If terms are unclear or
> restrictive, store **only a reference link** and let customers enter the value
> manually. Licensed sources are **not** imported; the model is prepared so they
> can be plugged in once licensed.

Model recollection is **never** a source for any value (§0.7 / §7): every imported
or extracted value carries provenance, and every computed result is labelled a
*Prüfhinweis* / *Berechnungsvorschlag*.

## Legend
- **Import** — may be loaded into a catalogue via the reconciled `official-import`
  path (ERGO §3.19).
- **Reference only** — link + manual entry; not bulk-imported (licence unclear/
  restrictive, or not machine-reconcilable here).
- **Prepared** — schema/engine ready; data plugged in once licensed/reachable.

## Environment note (build-time access)
EUR-Lex, RIS and gesetze-im-internet.de are **bot-protected** in the build
environment (EUR-Lex returns HTTP 202 with an empty body; RIS returned 503 during
B4). Sources flagged *import* below are licence-clear to import, but the official
files must be reached from an unblocked network or supplied by the founder before
the importer can run and a catalogue version can be activated. Nothing is seeded
from recollection in the meantime; catalogue versions stay inactive until they
reconcile.

## S1 — CLP reference data
| Source | Content | Reuse basis | Decision | Status |
|---|---|---|---|---|
| CLP Reg (EC) 1272/2008, Annex III (EUR-Lex consolidated) | H + EUH statement wordings (EN/DE) | EU legislation — reuse permitted | Import | Not yet imported (EUR-Lex blocked) |
| CLP Reg (EC) 1272/2008, Annex IV (EUR-Lex consolidated) | P (precautionary) statement wordings (EN/DE) — *note: P-statements live in Annex IV, not Annex III as the plan's shorthand says; recorded in CHEMISTRY_ENGINE_NOTES* | EU legislation | Import | Not yet imported |
| CLP Annex I / Annex V | Hazard class/category → pictogram + signal word rules | EU legislation | Import | Not yet imported |
| CLP Annex VI, Table 3 (EUR-Lex / ECHA C&L) | Harmonised classifications | EU legislation | Import | Not yet imported |
| Delegated Reg (EU) 2023/707 | New hazard classes (ED, PBT/vPvB, PMT/vPvM; EUH380–EUH451) | EU legislation | Import | Not yet imported; application dates to confirm from official text |

## S4 — Occupational exposure limits
| Source | Content | Reuse basis | Decision | Status |
|---|---|---|---|---|
| AT GKV Anhang I (RIS, consolidated) | MAK / TRK values | AT official legal text | Import | Prepared (S4) |
| DE TRGS 900 | Arbeitsplatzgrenzwerte (AGW) | DE official technical rule | Import | Prepared (S4) |
| DE TRGS 910 | Akzeptanz-/Toleranzkonzentrationen | DE official technical rule | Import where machine-importable, else Reference only | Prepared (S4) |
| EU OEL directives (EUR-Lex) | IOELV / BOELV | EU legislation | Import | Prepared (S4) |
| CH Suva (Grenzwerte am Arbeitsplatz) | CH MAK etc. | Verify reuse terms | Reference only unless terms clearly permit; hidden until CH verified | Prepared, hidden (S4) |
| GESTIS international limit values | International OELs | Licensed | Prepared (jurisdiction field accepts any country) | Not imported |

## S5 — WGK, storage, flammables
| Source | Content | Reuse basis | Decision | Status |
|---|---|---|---|---|
| UBA Rigoletto (DE) | Substance WGK | Verify reuse terms | Import if permitted, else Reference + manual | Prepared (S5) |
| TRGS 510 | Lagerklassen + Zusammenlagerungs-matrix | DE official technical rule | Import | Prepared (S5) |
| AT VbF (RIS) | Flammable-liquid classes by flash point | AT official legal text | Import (`seed-check` on the legal row) | Prepared (S5) |

## S6 — Raw-material properties
| Source | Content | Reuse basis | Decision | Status |
|---|---|---|---|---|
| PubChem | Experimental physical properties | Public-domain records **only** (skip depositor-restricted) | Import | Prepared (S6) |
| Supplier SDS (per tenant) | Confirmed property values | Business document; company-scoped | Stored per tenant via S2 confirm | Prepared (S6) |

## S2 / S7 — AI (SDS extraction, hint explanations, Betriebsanweisung drafts)
| Source | Content | Basis | Decision | Status |
|---|---|---|---|---|
| Anthropic Claude (official SDK, server-side, tenant-scoped) | SDS field extraction, plain-German hint text, BA draft free text | Sub-processor; SDS carry no worker data, supplier contacts are business data | Used inside fixed functions only (§0.6) | To build (S2/S7); add Anthropic to sub-processor list + TOMs (P13 §7) |

## Transport / ADR dangerous-goods list (P16 §3.3)
Investigation (2026-11-14): **no official UNECE machine-readable ADR Table A under
open reuse terms was found.** UNECE publishes ADR (ECE/TRANS/…) as PDF under UN
copyright; third-party machine-readable datasets (e.g. Labeline-licensed CSVs,
carrier Excel tables) are licensed or have unclear reuse terms. IMDG and IATA DGR
stay excluded (licensed), per §0.1/§0.3.

**Decision:** keep a small **curated `DEMO_LIST`** (`TRANSPORT_DEMO_LIST` in
`src/lib/chemicals/engines/transport-classification.ts`, `TRANSPORT_LIST_IS_DEMO =
true`) for the prospect sandbox — **not ADR-verified, not authoritative.** It is
available in both environments; a UN number outside it resolves to the honest
"Gefahrgutliste nicht geladen" gap. Replace it with a licensed/official list (ADR
only) before any real transport use.

## Licensed, not imported (prepared only)
GESTIS international limit values, IMDG Code, IATA DGR, EuPhraC phrase catalogue —
model prepared so they can be plugged in once licensed (§0.3, §3).
