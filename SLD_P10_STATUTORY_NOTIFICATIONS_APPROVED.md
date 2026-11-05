# SLD P10 — Statutory notifications & incident retention: founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-05. Delegated desk research and review by Claude, accepted by the founder, against the official portals and consolidated-text mirrors cited per row. `verificationMethod` per row: `official` = Stand read on the official portal; `mirror` = confirmed via a consolidated mirror or an official authority publication (DGUV/AUVA/govt portal) that is not the primary statute page; `seed-check` = CC reads the Stand on the official page at seed and skips the row if unreadable.

Replaces `SLD_P10_STATUTORY_NOTIFICATIONS_DRAFT.md`. Seed only §A.1 and §B.1. Everything in §A.2/§B.2 is deferred with a reason. CC: follow §D. Nothing is seeded from recollection; the fail-closed, no-cross-country-borrow rule (§3.15) holds.

---

## Answers to CC's six questions

1. **AT §363 ASVG (5 days):** confirmed. **DE §193 SGB VII (3 days):** confirmed. Both below with exact thresholds.
2. **CH:** confirmed your recommendation. UVG/VUV and Suva say **"so rasch wie möglich"** with no statutory day-count. Model CH as `asSoonAsPossible: true`, no fixed `deadline`. Do **not** seed the secondary-source 3-day figure. CH stays positioning-only anyway.
3. **DE fatal/mass "unverzüglich":** confirmed — model as an **`immediate: true` flag**, not `P0D`. The UI shows "sofort/unverzüglich", never "in 0 Tagen".
4. **AT §363 Abs. 2 physician duty:** confirmed **out of scope** for the employer surface. The employer's own duty for both Arbeitsunfall and suspected Berufskrankheit sits in §363 Abs. 1; Abs. 2 is the treating physician's separate duty and is not shown as an employer deadline.
5. **§B retention:** filled below where I could corroborate to statute/authority (AT §16 ASchG, DE §24 DGUV V1), POLICY_DEFAULT elsewhere with the basis stated honestly.
6. **Stamp:** `verifiedBy = "Colin Buzoianu"`, `verifiedAt = 2026-11-05`, `verificationMethod` per row.

---

## A. Notification deadline catalogue — `IncidentNotificationRule`

Versioned, single-active `IncidentNotificationCatalogVersion` id `v1-dach-2026`. One row per (country × incident type) with a statutory employer notification duty. `deadline` is ISO-8601 or null; `immediate` and `asSoonAsPossible` are booleans (exactly one of {`deadline` set, `immediate`, `asSoonAsPossible`} is true, CHECK). `legalReferenceId` points into the P3 `LegalReference` catalogue — seed the three new legal rows in §C first. Fail-closed: a (country, type) with no row ⇒ "keine Meldepflicht hinterlegt", never a cross-country borrow.

### A.1 Seed these

**AT — Austria** (§ 363 Abs. 1 ASVG, idF BGBl. I Nr. 106/2024, in force 01.03.2024; recipient = zuständiger Unfallversicherungsträger, e.g. AUVA)

| incident type | threshold | deadline | clock starts | immediate | legal ref | method |
|---|---|---|---|---|---|---|
| `ARBEITSUNFALL` | death, **or** >3 days fully/partially incapacitated | **P5D** | date of the accident | false | AT-N1 | mirror |
| `WEGEUNFALL` | same, where insured | **P5D** | date of the accident | false | AT-N1 | mirror |
| `BERUFSKRANKHEIT_VERDACHT` | employer has grounds to suspect an occupational disease | **P5D** | knowledge of the suspicion | false | AT-N1 | mirror |

**DE — Germany** (§ 193 SGB VII; recipient = Unfallversicherungsträger; the Betriebs-/Personalrat co-signs, § 193 Abs. 5 — this is the `works_council` hook)

| incident type | threshold | deadline | clock starts | immediate | legal ref | method |
|---|---|---|---|---|---|---|
| `ARBEITSUNFALL` | death, **or** >3 days incapacity | **P3D** | employer gains knowledge | false | DE-N1 | seed-check |
| `WEGEUNFALL` | same | **P3D** | employer gains knowledge | false | DE-N1 | seed-check |
| `BERUFSKRANKHEIT_VERDACHT` | employer has Anhaltspunkte (§ 193 Abs. 2) | **P3D** | knowledge of the grounds | false | DE-N1 | seed-check |
| `ARBEITSUNFALL` (fatal / mass: death, or >3 injured needing treatment) | per the official Unfallanzeige guidance | — | employer gains knowledge | **true** | DE-N1 | mirror |

The DE fatal/mass "sofort" case is a second row with `immediate: true`, same legal ref. Threshold wording in the row's own field; the "immediate" obligation is from the official Unfallanzeige Erläuterungen, so method `mirror`.

**CH — Switzerland** (positioning-only; build the rows but keep the pack `verified: false`, so they don't render on a live CH site)

| incident type | threshold | asSoonAsPossible | legal ref | method |
|---|---|---|---|---|
| `ARBEITSUNFALL` (Berufsunfall) | any accident needing treatment / causing incapacity | **true** | CH-N1 | mirror |
| `WEGEUNFALL` (Nichtberufsunfall) | as above, where insured | **true** | CH-N1 | mirror |
| `BERUFSKRANKHEIT_VERDACHT` | suspicion of an occupational disease | **true** | CH-N1 | mirror |

### A.2 Deferred (do not seed; flagged for a later pass)
- **AT fatal/serious → Arbeitsinspektorat "unverzüglich":** a real, separate duty (notify the labour inspectorate at once for a fatal or serious accident), confirmed on the government portal (usp.gv.at) but I could not pin the exact statute section (likely ArbIG). Do not seed a citation without the anchor. Carry it as a deferred row; find the ArbIG § in the next AT pass. Until then the incident UI must not state it.
- **AT death within 3 days:** govt-portal guidance says a death is to be reported within 3 days even if already notified. Treated as a nuance to confirm against the statute before narrowing the AT fatal deadline; not seeded separately now (the 5-day rule already covers the duty to notify).

---

## B. Incident / health / first-aid retention — new `RetentionRule` rows

New `RetentionRecordType` values (enum-first): `INCIDENT`, `INCIDENT_HEALTH`, `FIRST_AID_RECORD`. New catalogue version `v3-2026-11`, copying v2 forward verbatim (existing pattern). `basis` ∈ {`STATUTORY`, `NO_STATUTORY_PERIOD`, `POLICY_DEFAULT`}; `STATUTORY` requires `minRetention` + `sourceUrl` (the existing CHECK).

### B.1 Seed these

| country | recordType | basis | minRetention | trigger | source | method |
|---|---|---|---|---|---|---|
| AT | `INCIDENT` | STATUTORY | **P5Y** | RECORD_DATE | § 16 ASchG — Aufzeichnungen über Arbeitsunfälle (>3 Tage AU oder tödlich), mind. 5 Jahre; https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=16 | mirror |
| DE | `FIRST_AID_RECORD` | STATUTORY | **P5Y** | RECORD_DATE | § 24 Abs. 6 DGUV Vorschrift 1 — Verbandbuch/Erste-Hilfe-Dokumentation, 5 Jahre nach der (letzten) Eintragung; DGUV Information 204-020 | mirror |
| DE | `INCIDENT` | POLICY_DEFAULT | P5Y | RECORD_DATE | No distinct statutory period for the employer's Unfallanzeige copy; default aligned with the 5-year Personalunterlagen/Verbandbuch norm | — |
| AT | `FIRST_AID_RECORD` | POLICY_DEFAULT | P5Y | RECORD_DATE | No AT equivalent of the DGUV Verbandbuch rule found; default aligned with § 16 ASchG | — |
| AT, DE | `INCIDENT_HEALTH` | POLICY_DEFAULT | **P10Y** | END_OF_EMPLOYMENT | No single statutory period for incident health fields. Long-latency occupational-health precedents (AT § 47 ASchG / DE AMR 6.1 to ArbMedVV: 40 years for CMR) are handled by the **exposure register**, not the incident record. Default 10 years; a company may extend. | — |

**UI note for every POLICY_DEFAULT row:** *"Keine eigenständige gesetzliche Aufbewahrungsfrist; Frist nach Unternehmensrichtlinie."* For the two STATUTORY rows, show the § and source.

### B.2 Deferred / handled elsewhere (do not seed here)
- **Per-person exposure / long-latency health register (40 years):** AT § 47 ASchG (employer keeps until end of exposure, then transmits to the Unfallversicherungsträger, who keeps ≥40 years) and DE § 10a GefStoffV / AMR 6.1 to ArbMedVV (40 years CMR, 5 years reprotoxic). These live in the **exposure register** work (P8 reserved the record types; the transmission/export function is P10's health-compartment build), not in `INCIDENT_HEALTH`. Keep the two models separate.
- **CH incident/health/first-aid retention:** deferred with the rest of CH.
- **DE noise exposure register / AT § 65 VOLV:** separate exposure track, not incidents.

---

## C. New `LegalReference` rows (seed into the P3 catalogue, before §A)

| code | country | reference | obligation (our wording) | sourceUrl | method |
|---|---|---|---|---|---|
| AT-N1 | AT | § 363 Abs. 1 ASVG | Meldung jedes Arbeitsunfalls (Tod oder >3 Tage Arbeitsunfähigkeit) und begründeten Berufskrankheitsverdachts an den zuständigen Unfallversicherungsträger, längstens binnen 5 Tagen | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008147&Paragraf=363 | mirror |
| DE-N1 | DE | § 193 SGB VII | Unfallanzeige an den Unfallversicherungsträger bei Tod oder >3 Tagen Arbeitsunfähigkeit, binnen 3 Tagen ab Kenntnis; Mitunterzeichnung durch den Betriebs-/Personalrat (Abs. 5) | https://www.gesetze-im-internet.de/sgb_7/__193.html | seed-check |
| CH-N1 | CH | UVG (SR 832.20) / VUV | Meldung von Berufs- und Nichtberufsunfällen sowie Berufskrankheiten an den Versicherer, so rasch wie möglich | https://www.fedlex.admin.ch/eli/cc/1982/1676_1676_1676/de | mirror |

AT-N1 Gesetzesnummer (ASVG) is **10008147** — CC confirms it resolves at seed, same seed-check discipline as the P3 AT rows. The DE Stand changed in 2026 (Standortfördergesetz) — read the exact "Zuletzt geändert" at seed.

---

## D. Build instructions (slices, commit + push after each, tests green)
1. **Legal rows (§C) first**, into the existing P3 `LegalReference` catalogue, so the notification rules can reference them. `seed-check` rows: read the Stand, skip + report if unreadable.
2. **`IncidentNotificationCatalogVersion` + `IncidentNotificationRule`** (enum-first for any new enum). CHECK: exactly one of {deadline, immediate, asSoonAsPossible}. Seed §A.1. A pure `resolveNotificationDeadline(country, type, knownAt)` returns the due date, the `immediate`/`asSoonAsPossible` flag, or a fail-closed "keine Meldepflicht hinterlegt". Unit tests incl. the DE immediate row and the fail-closed miss.
3. **Retention (§B.1)** under catalogue `v3-2026-11`, new record types + any new trigger. Wire `INCIDENT`/`FIRST_AID_RECORD`/`INCIDENT_HEALTH` into the existing retention/anonymisation batch flow from P7b/P8: proposal → company-admin approval → audited action, honouring `Person.legalHold`. `INCIDENT_HEALTH` deletion is **never** co-approved in the same batch as person anonymisation (the P7d/P8 discipline); health-compartment reads stay audited.
4. **P10d — notifications sub-page:** replace the placeholder. For an incident, show the resolved duty per the site's country: the deadline and a countdown, or "sofort/unverzüglich", or "so rasch wie möglich"; the legal reference line from the catalogue; the works-council co-sign reminder for DE. Pre-filled **data export / print view** for the authority form (AUVA Unfallmeldung / DE Unfallanzeige) — never a look-alike of the authority's own form. Record "submitted on / reference number". Archive via `GeneratedDocument`.
5. **P10e — Verbandbuch + demo + retention UI:** first-aid record type with its 5-year rule; the retention settings surface shows the new record types; AT and DE demo incidents (one notifiable Arbeitsunfall each with its countdown, one first-aid entry, one on legal hold).
6. **Verify.** tsc/Biome/Vitest green. German HTTP walkthrough on AT and DE: raise a notifiable Arbeitsunfall, see the correct deadline (AT 5 d / DE 3 d), the DE works-council reminder, a fatal case showing "sofort"; a CH site shows the honest gap. Render the pre-filled notification export. Update CLAUDE.md status; remove the P10 legal-content gate from the deferral list. Then continue with **P11 (Rechtskataster)**.
