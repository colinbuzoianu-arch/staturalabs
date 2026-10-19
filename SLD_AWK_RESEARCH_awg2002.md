# AWK generator (E4) — AWG 2002 provisions for human verification

**Status: research deliverable for founder verification. No code, no document template generated.**
Per `SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md` §6/§9 ("Before E4, stop and give me the list of AWG 2002 provisions the AWK must satisfy, with RIS links, for human verification. Do not generate the document template until I confirm.") and the §6 verification bar (same discipline as the VOLV/B4 seed: do not let CC seed a legal value or duty from its own recollection — RIS-verify first).

## Legal basis

- **Abfallwirtschaftsgesetz 2002 (AWG 2002), §10 — Abfallwirtschaftskonzept (AWK).**
  - Consolidated law (geltende Fassung): https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20002086
  - §10 direct: https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20002086&Paragraf=10
- Secondary (for orientation only, not a legal source): WKO — "Wann benötige ich ein Abfallwirtschaftskonzept?" https://www.wko.at/betriebsanlagen/wann-abfallwirtschaftskonzept and "Abfallwirtschaft im Betrieb" https://www.wko.at/abfall/abfallwirtschaft-betrieb

## What RIS §10 says (fetched 2026-10-16 — RE-VERIFY against the current Fassung before any customer sees output)

> ⚠️ The §10 text fetched this session was labelled in force since 16.02.2011 (last amended BGBl. I Nr. 9/2011), while the consolidated-law listing showed a "Fassung vom 29.05.2026". The substance below is corroborated by both the RIS §10 fetch and WKO secondary guidance, but a human must open the two RIS links above and confirm the current wording of each Absatz — especially the exact content items (Abs 3) and the update cycle (Abs 5) — before the AWK generator is built or shipped. This is the §6 bar; treat every line below as *to-be-verified*, not verified.

- **Who must prepare one (Abs 1):** an operating facility (Anlage) where waste arises and **more than 20 employees** work. Several legal entities operating one facility may prepare a joint concept. A valid EMAS environmental statement for a participating site counts as the concept.
- **Deadline (Abs 2):** the concept must exist **within twelve months** after operations start, or after the 21st employee is hired.
- **Update cycle (Abs 5):** update after any **substantial waste-relevant change** to the facility, and **at least every seven years**. Updating a valid EMAS statement counts as an update.
- **Required contents (Abs 3, Z 1–5):**
  1. Information on the facility's industry/sector and purpose, plus a **list of all plant components** (Anlagenteile).
  2. A **process-related** description of the operation (betriebsbezogene / ablaufbezogene Beschreibung).
  3. A **waste-related** description of the operation (abfallrelevante Beschreibung) — i.e. the waste streams.
  4. **Organisational measures** to comply with waste law.
  5. An **estimate of future development** (voraussichtliche Entwicklung).
- **Authority submission (Abs 4):** the concept must be produced on the authority's request; if incomplete, the authority can order improvements by Bescheid.
- **Permit interplay (Abs 6):** for concepts required under a facility permit (§37 GewO 1994 or the Mineralrohstoffgesetz), Abs 1 last sentence and Abs 3–5 apply.

## How each required content item maps to SLD data (proposed, for the founder's review)

This is the mapping the E4 `AwkDocument.tsx` generator would use once E1–E3 exist (the AWK is the environmental-domain counterpart of the SGD):

| AWG §10 Abs 3 item | SLD source (after E1–E3) |
|---|---|
| Z1 industry/purpose + plant-component list | `Site` (Betrieb/Arbeitsstätte) + `OrgUnit` tree / `Workstation`s as Anlagenteile |
| Z2 process-related description | `Process` + its `ProcessTask`s |
| Z3 waste-related description | `WasteStream` rows (E2) + `WASTE_*`/`AIR_EMISSIONS`/… environmental findings + `EnvironmentalQuantity` |
| Z4 organisational measures | `Action`s with `environmentalMeasureType` (E1) |
| Z5 future-development estimate | free-text field on the environmental assessment (new, E2/E4 — needs a home; flag for design) |

Open mapping question for the founder: Z5 ("estimate of future development") has no obvious existing column — it likely needs a dedicated free-text field on the site-level environmental assessment, decided during E2/E4.

## Scope gate (unchanged from the plan)

- Country-gated and fail-closed, exactly like the SGD (§3.15): the AWK generator is **AT-only** until `CountryPack.verified` + an AWK template variant exist; DE/CH get an honest "gap" stub, never borrowed AT content.
- The 20-employee threshold and 7-year cycle go into the migration/seed **comments** with the RIS links, and are re-verified by a human first — not seeded from model recollection.
- **E4 built (Oct 2026)** on the founder's RIS confirmation of §10 AWG 2002 (Fassung 16.02.2011, BGBl. I Nr. 9/2011): `GET /api/sites/[siteId]/awk` → `src/lib/report/AwkDocument.tsx`, five sections mapped to Abs. 3 Z1–5, country-gated AT-only (`resolveAwkCountryPack`, fail-closed for DE/CH/RO), EMAS sites marked exempt (§10 Abs. 1), the §37 GewO/MinroG case noted per Abs. 6. Z5 is a new `EnvironmentalAssessment.futureDevelopment` field. No numeric legal value appears that wasn't in the RIS text. Deferred: the AT→200 / RO→400 PDF HTTP walkthrough (browser/dev-server bucket).

Sources: [RIS AWG 2002 geltende Fassung](https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20002086), [RIS AWG 2002 §10](https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20002086&Paragraf=10), [WKO — Wann benötige ich ein AWK?](https://www.wko.at/betriebsanlagen/wann-abfallwirtschaftskonzept), [WKO — Abfallwirtschaft im Betrieb](https://www.wko.at/abfall/abfallwirtschaft-betrieb)
