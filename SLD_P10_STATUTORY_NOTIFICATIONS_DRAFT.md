# SLD P10 — Statutory notification & incident-retention catalogue: DRAFT for founder verification

**Status: DRAFT — NOT SEEDED, NOT SHOWN IN UI. Every value below is a candidate drawn from the cited source and must be confirmed by you against the official consolidated text before I seed it or write it into any UI string.**

This is the legal content P10 depends on (`SLD_P10_COMPARTMENT_DESIGN_NOTE.md` §6), drafted per `SLD_RESTRUCTURE_PLAN_platform-modules.md` §9/§11: *"For every legal reference, deadline, retention period or limit, draft the catalogue rows with official source links (RIS, gesetze-im-internet.de, fedlex, DGUV, Suva) and stop for my verification before seeding or writing UI text."*

I researched each row against the cited sources listed at the bottom. **The German and Austrian figures I was able to corroborate against the statute text; the Swiss deadline I could only corroborate against secondary (Ratgeber/software-vendor) sources — Suva's own wording is "so rasch wie möglich" with no fixed day-count, so the CH row is flagged `UNVERIFIED` and needs your UVG/VUV read.** No figure here is treated as verified. I do not seed from my own recollection — these are candidates for your check.

The provenance columns match the existing catalogue pattern (`LegalReference` / `RetentionRule`): `verificationMethod` ∈ {`official`, `mirror`, `seed-check`}, plus `verifiedBy` (you) and `verifiedAt` (the date you confirm). Until then every row is `UNVERIFIED`.

---

## A. Notification deadline catalogue — `IncidentNotificationRule` (candidates)

New versioned, single-active `IncidentNotificationCatalogVersion` (proposed id `v1-dach-2026`). One row per (country × incident type) that carries a statutory notification duty. The deadline is an **ISO-8601 duration** (clock starts per the "clock starts" column); the threshold is the condition that triggers the duty; `legalReferenceId` points into the existing P3 `LegalReference` catalogue (so the legal citation is itself a verified catalogue row, not inline text). Fail-closed: a (country, type) with no row ⇒ "no notification rule on file" — never a cross-country borrow (§3.15).

### AT — Austria

| incident type | duty threshold | deadline | clock starts | legal ref (code) | source | status |
|---|---|---|---|---|---|---|
| `ARBEITSUNFALL` | death, **or** total/partial incapacity **> 3 days** | **P5D** (within 5 days) | date of the accident | § 363 ASVG (Unfallmeldung) | RIS / gesetzefinden.at (see sources) | **UNVERIFIED — confirm Stand on RIS** |
| `WEGEUNFALL` | treated as Arbeitsunfall where insured | **P5D** | date of the accident | § 363 ASVG | RIS | **UNVERIFIED** |
| `BERUFSKRANKHEIT_VERDACHT` | suspicion of an occupational disease | **P5D** | knowledge of the suspicion | § 363 Abs. 2 ASVG (physician/clinic duty) | RIS | **UNVERIFIED — confirm who carries the duty (Träger/Arzt) and whether it belongs in the product's notification surface at all** |

*Notes for AT:* the threshold wording is "mehr als drei Tage ganz oder teilweise arbeitsunfähig" **or** death; the form is the AUVA Unfallmeldung (electronic via ELDA in practice). The §363 Abs. 2 physician-duty for Berufskrankheit-Verdacht may be out of the product's scope (it is the clinic's/Träger's duty, not the employer's) — flag for your call before we show it as an employer deadline.

### DE — Germany

| incident type | duty threshold | deadline | clock starts | legal ref (code) | source | status |
|---|---|---|---|---|---|---|
| `ARBEITSUNFALL` | death, **or** incapacity **> 3 days** | **P3D** (within 3 days) | the employer **gains knowledge** of the accident | § 193 Abs. 1 SGB VII (Unfallanzeige) | gesetze-im-internet.de / dejure (see sources) | **UNVERIFIED — confirm on gesetze-im-internet** |
| `WEGEUNFALL` | death, or incapacity > 3 days | **P3D** | employer's knowledge | § 193 Abs. 1 SGB VII | gesetze-im-internet.de | **UNVERIFIED** |
| `BERUFSKRANKHEIT_VERDACHT` | reasonable grounds (Anhaltspunkte) for an occupational disease | **P3D** | employer's knowledge of the grounds | § 193 Abs. 2 SGB VII | gesetze-im-internet.de | **UNVERIFIED** |
| `ERSTE_HILFE` (Verbandbuch, **not** a BG notification) | any first-aid event (no > 3-day incapacity) | — **no authority notification** | — | § 24 Abs. 6 DGUV Vorschrift 1 (documentation duty) | DGUV | **UNVERIFIED — this is a *documentation*, not a *notification*; see §B retention, not §A deadline** |

*Notes for DE:* threshold is "mehr als drei Tage" (strictly more than three). Fatal accidents and mass events (> 3 injured needing treatment) are **"unverzüglich"** (immediate) — I propose representing that as a separate `immediate: true` flag on the rule rather than a `P0D` duration, so the UI says "sofort/unverzüglich" rather than a misleading "0 days". Confirm you want that modelled. The works-council co-signs the Unfallanzeige (§ 193 Abs. 5 SGB VII) — this is the `WORKS_COUNCIL` role's hook in the design note.

### CH — Switzerland

| incident type | duty threshold | deadline | clock starts | legal ref (code) | source | status |
|---|---|---|---|---|---|---|
| `ARBEITSUNFALL` (Berufsunfall) | any accident requiring treatment / causing incapacity | **"so rasch wie möglich"** — Suva's official wording; the commonly-cited **P3D (3 calendar days)** is from secondary sources only | employer's knowledge of the accident | UVG / VUV (Verordnung über die Unfallversicherung) + Suva Schadenmeldung | Suva + fedlex (see sources) | **UNVERIFIED — needs your fedlex UVG/VUV read; the 3-day figure is NOT from an official source** |
| `WEGEUNFALL` (Nichtberufsunfall / as Berufsunfall for low-hours insured) | as above | "so rasch wie möglich" (3D per secondary sources) | employer's knowledge | UVG / VUV | Suva + fedlex | **UNVERIFIED** |
| `BERUFSKRANKHEIT_VERDACHT` | suspicion of an occupational disease | "so rasch wie möglich" | knowledge of the suspicion | UVG | fedlex | **UNVERIFIED** |

*Notes for CH:* I could **not** find a fixed statutory day-count on a Suva or fedlex page — Suva says "so rasch wie möglich". The 3-calendar-day figure appears only in third-party guidance (a compliance Ratgeber and payroll-software docs). **Recommendation: model CH as `asSoonAsPossible: true` with no fixed `deadline` duration** unless your fedlex VUV read turns up an explicit period, rather than seed a secondary-source number as if it were statute. This is the single most important thing to verify before CH goes live.

---

## B. Incident / health / first-aid retention — new `RetentionRule` rows (candidates)

New `RetentionRecordType` values (enum-first migration): `INCIDENT`, `INCIDENT_HEALTH`, `FIRST_AID_RECORD`. Candidate periods under a new `RetentionRuleCatalogVersion` (proposed `v3-2026-11`, copying the v2 rows forward verbatim as the existing pattern does). **All periods below are UNVERIFIED candidates** — accident-record and especially health-record retention is a tangle of social-insurance, occupational-health and general limitation periods, and I will not seed any of it from recollection.

| country | record type | candidate min retention | basis | trigger | source to verify against | status |
|---|---|---|---|---|---|---|
| AT | `INCIDENT` | *(to determine)* | STATUTORY? | RECORD_DATE | ASVG / DokVO / general | **UNVERIFIED — needs your source** |
| AT | `INCIDENT_HEALTH` | *(to determine — occupational-health records are typically long, cf. the P8 CMR P40Y precedent, but confirm the basis)* | STATUTORY? | END_OF_EMPLOYMENT? | ASchG / VGÜ / ArbeitnehmerInnenschutz | **UNVERIFIED** |
| AT | `FIRST_AID_RECORD` | *(to determine)* | POLICY_DEFAULT? | RECORD_DATE | — | **UNVERIFIED** |
| DE | `INCIDENT` | commonly cited **P5Y** for the Unfallanzeige copy — **confirm** | STATUTORY? | RECORD_DATE | DGUV Vorschrift 1 / SGB VII | **UNVERIFIED** |
| DE | `INCIDENT_HEALTH` | *(to determine — cf. long occupational-health retention, e.g. the GefStoffV exposure-register precedent)* | STATUTORY? | END_OF_EMPLOYMENT? | ArbMedVV / GefStoffV | **UNVERIFIED** |
| DE | `FIRST_AID_RECORD` | Verbandbuch commonly cited **P5Y** after the entry — **confirm** | STATUTORY? | RECORD_DATE | § 24 Abs. 6 DGUV Vorschrift 1 | **UNVERIFIED** |
| CH | `INCIDENT` | *(to determine)* | STATUTORY? | RECORD_DATE | UVG / VUV | **UNVERIFIED** |
| CH | `INCIDENT_HEALTH` | *(to determine)* | STATUTORY? | END_OF_EMPLOYMENT? | UVG / ArGV 3 | **UNVERIFIED** |
| CH | `FIRST_AID_RECORD` | *(to determine)* | POLICY_DEFAULT? | RECORD_DATE | — | **UNVERIFIED** |

The deletion mechanics (a `RetentionBatch`-style proposal respecting `Person.legalHold`, never co-approved with person anonymisation — the P7d/P8 discipline) are built structurally in P10c/P10e regardless; only the **periods** wait on this table.

---

## C. What I need from you

1. **Confirm or correct each AT/DE deadline** in §A against RIS (§363 ASVG) and gesetze-im-internet.de (§193 SGB VII) — I believe these are right but they are your statute to confirm.
2. **The CH row is the real open one** — read UVG/VUV on fedlex and tell me either the statutory period or that "so rasch wie möglich" (no fixed count) is the correct model. I recommend not seeding the secondary-source 3-day figure as statute.
3. **The DE "unverzüglich" (fatal / mass) case** — confirm you want it as an `immediate` flag rather than a day-count.
4. **The AT §363 Abs. 2 Berufskrankheit physician-duty** — confirm whether it belongs on the employer-facing notification surface at all.
5. **Fill the §B retention periods**, or point me at the sources and I'll draft candidates for a second verification pass.
6. Give me the `verifiedBy` name/date to stamp on the rows you approve, and the `verificationMethod` (`official` if you read the portal Stand, `mirror` if via a consolidated mirror).

On your return of an approved `SLD_P10_STATUTORY_NOTIFICATIONS_APPROVED.md` I seed exactly the approved rows and build the P10d/P10e notification + retention surfaces — no legal value from my own recollection, same gate as P3/P6/P8.

---

## Sources consulted (for your verification — not authority in themselves)

**AT — § 363 ASVG (Unfallmeldung, 5-day / >3-day-incapacity-or-death):**
- [§ 363 ASVG — gesetzefinden.at](https://gesetzefinden.at/bundesrecht/bundesgesetze/asvg/para-363?id=10008147)
- [ASVG § 363 — lawthek](https://admin.lawthek.eu/detail/8f8fbb69-d60f-4b4e-9d35-47581c2eae05/de/)
- AUVA Unfallmeldung form page (meine-uv.at) — practice/form, not statute.
- **Authoritative check: RIS (ris.bka.gv.at), ASVG consolidated text, current Stand.**

**DE — § 193 SGB VII (Unfallanzeige, 3-day / >3-day-incapacity-or-death):**
- [§ 193 SGB VII — dejure.org](https://dejure.org/gesetze/SGB_VII/193.html)
- [BG ETEM — Unfall melden](https://www.bgetem.de/unfall-berufskrankheit/was-tun-bei-arbeitsunfall/unfall-melden)
- **Authoritative check: gesetze-im-internet.de/sgb_7/__193.html, current Fassung.**

**CH — UVG / VUV + Suva (the open one):**
- [Suva — Unfall/Schaden korrekt melden](https://www.suva.ch/de-ch/unfall/schadenabwicklung/schadenmeldung/unfall-schaden-korrekt-melden) — official wording "so rasch wie möglich", **no fixed day-count**.
- [Suva — Formular Schadenmeldung UVG](https://www.suva.ch/de-ch/download/dokument/formular--schadenmeldung-uvg/formular--schadenmeldung-uvg--109.d)
- Secondary (3-day figure, **not** authoritative): ssa-system.ch Ratgeber.
- **Authoritative check: fedlex.admin.ch — UVG (SR 832.20) and VUV (SR 832.30).**
