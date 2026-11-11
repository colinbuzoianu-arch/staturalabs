# SLD P14 — DACH portfolio gap-closure: founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-11. Closes the in-scope gaps found when mapping SLD against the 2026 portfolio spec, **adapted to DACH** and with **e-learning excluded**. Not a legal-content gate — CC builds autonomously, same engineering rules as always (module registry, subject helper, one action engine, catalogues as versioned data, hand-written migrations, enum-first, RLS policies + non-owner role from P13, `Restrict` FKs, append-only history, `AuditEvent`, person-free of the assessment chain, DE/EN/RO, tsc/Biome/Vitest green per commit, slice by slice with commit + push).

## 0. What this is and isn't

The portfolio spec is a US-market platform; SLD is DACH. This milestone builds only the items that (a) fit the DACH market and (b) SLD doesn't already cover. Everything US-specific already has a DACH equivalent in SLD and is **not** rebuilt.

**Do NOT build (explicitly out of scope):**
- US statutory reporting (OSHA 300 / 301 / 300A, BLS survey) — SLD's SGD, Gefahrstoffverzeichnis, Unfallanzeige/AUVA export and KPIs are the DACH equivalents.
- Workers' comp claim submission / return-data interfaces — the DACH Unfallmeldung export (P10) already covers the notification duty.
- Spanish / French-Canadian — SLD is DE (de-AT/de-DE/de-CH) + EN + RO.
- Quality incidents, employee performance evaluation — outside EHS scope and the person-safe design.
- **E-learning (Quiz module, online course library)** — excluded by founder decision.
- SSO/SAML, SAP/HRIS feed, SFTP, billing — deferred separately (P13 §8), not part of P14.

**Person-safety holds throughout:** nothing here links a worker to the assessment chain; workforce figures are aggregates, not person records; incident-linked people stay in the incident compartment.

---

## G1 — Arbeitsstunden & Personalstand (workforce figures → unlocks rate KPIs)

The one real functional gap: SLD can't compute injury *rates* because it has no hours/headcount input.

- **`SiteWorkforcePeriod`** (person-free aggregates): `siteId`, optional `orgUnitId`, `period` (year + month or quarter), `headcount` (FTE or count), `hoursWorked`, `setByUserId`, `setAt`. Entered manually per period or CSV-imported (reuse G3). No person rows.
- **Wire into the P12 KPI engine.** Add default `KpiDefinition` rows (versioned data, as P12) for the standard DACH/ILO safety rates, each configurable:
  - **Tausend-Personen-Quote** = meldepflichtige Unfälle × 1000 ÷ Personalstand.
  - **Unfallhäufigkeit (per 1 Mio. Arbeitsstunden)** = Unfälle × 1 000 000 ÷ Arbeitsstunden (LTIF-style).
  - **Schwere / Ausfalltage je Periode** and **Ausfalltage je Unfall**, from incident lost-day data (P10) ÷ workforce.
  - Near-miss ratio, already possible, now shown per headcount.
- Rates only compute for periods that have workforce figures; a period without them shows an honest "keine Arbeitsstunden hinterlegt", never a guessed denominator. Minimum-group-size rule (P3 §3.4) still applies.
- **Before building the formulas**, CC lists the default rate set above for a one-line founder confirm (which definitions ship active) — it's a choice, not a legal seed, so a quick nod, not a gate.

---

## G2 — Aktivitätenkalender (unified cross-module calendar)

The spec's "Activity Calendar". SLD has a per-actions calendar; make it platform-wide.

- A **read-only aggregation** (no new source of truth) over the due-dated items already in the system: open/overdue `Action`s, scheduled/overdue inspections (P9), assessment reviews due (P6), training due/overdue (P7), SDS review due (P8), legal-requirement reviews due (P11), incident follow-ups and notification deadlines (P10).
- Calendar + agenda views; filters by module, site, and responsible user (through the P7b scope helper — a manager sees only their units).
- Lives under **Übersicht** and feeds **Meine Aufgaben**. Reuses the Maßnahmen calendar component; each entry deep-links to its record.

---

## G3 — Import-Framework (historical & ongoing bulk upload)

The spec's "historical data upload / standard templates". Generalise the existing people CSV importer into one reusable pipeline.

- A shared importer: upload → column mapping → **dry-run with validation + error report** → commit, with a downloadable template per entity (the spec's "standard upload template"). Reuse the P7 people-import dry-run discipline.
- Importers for: **incidents** (person-safe — respects the compartment; health fields gated), **vehicle incidents**, **training records**, **substances/SDS**, **inspection history**, and **workforce periods** (G1). People and org-tree importers already exist — fold them into the same framework.
- One-time historical migration uses the same path; no separate migration tool.

---

## G4 — Fuhrpark / Fahrzeugstammdaten (fleet register)

The spec's "vehicle upload / fleet management". SLD has vehicle *incidents* (P10) but no vehicle *master*.

- **`Vehicle`**: `companyId`, optional `siteId`, `identifier` (Kennzeichen/intern), `type`, optional `orgUnitId`, `activeFrom`/`activeTo`. **Person-free** — no driver on the vehicle record; a driver involved in an incident stays in the incident compartment.
- Link P10's `Fahrzeugereignis` to an optional `vehicleId`, enabling fleet-level incident views and a vehicles-by-incident report (feeds G1/P12).
- CSV upload via G3.

---

## G5 — Beschwerden & Haftungsfälle (complaints & liability)

Round out the incident types the DACH source spec carried (the original German functional list had Beschwerden-adjacent and Haftungsfälle) that SLD only covers generically today.

- Confirm/extend P10 event types with **`BESCHWERDE`** (complaint) and **`HAFTUNGSFALL`** (liability), each with its light field set (complaint: source/subject, status; liability: claim basis, status, linked documents).
- The anonymous QR/report path (P10 D3) can also file a Beschwerde without a reporter identity.
- Person-safe; no new compartment.

---

## G6 — Mobile-Offline-Erweiterung

The spec's offline mobile for observations. SLD has an offline run-mode for inspections (P9); extend the pattern.

- Reuse the P9 offline queue for **Beobachtungen** (observations) and an **Ereignis-Schnellmeldung** (quick incident report) so floor staff capture offline and sync on reconnect.
- Photos follow the existing rule: conditions only, the "no people" upload notice stands.
- No app-wide offline rewrite — just these two capture flows.

---

## Build order (slices, commit + push after each, tests green)
1. **G1 — Arbeitsstunden & rate KPIs** (highest value; confirm the default formula set first).
2. **G2 — Aktivitätenkalender.**
3. **G3 — Import framework** (then migrate the existing people/org importers onto it).
4. **G4 — Fuhrpark**, link to vehicle incidents.
5. **G5 — Beschwerden & Haftungsfälle.**
6. **G6 — Mobile-Offline-Erweiterung.**

Each slice: register any new surface in the module registry, use the shell + primitives, DE/EN/RO strings, demo fixture updated (AT + DE), person-free schema test still green. When P14 lands, update CLAUDE.md status: SLD is feature-complete against the DACH-relevant portfolio, with only the deliberately deferred integrations (SSO, HRIS, SFTP, billing), the CH go-live, and the per-person exposure register (P8/P10) outstanding.

---

## Note on scope creep
Each G-item is deliberately bounded. If any turns out larger than its slice (G3's importer breadth is the likeliest), CC ships the core first (the shared pipeline + incident/workforce importers) and lists the rest for a follow-up, rather than letting one item stall the milestone. Nothing here needs a founder legal gate; the only check-in is the one-line KPI-formula confirm in G1.
