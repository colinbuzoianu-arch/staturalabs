# SLD P3 — DACH legal catalogue (risk module): founder-approved, ready to seed

**Approved by:** Colin Buzoianu (founder), 2026-11-02
**Verification method:** delegated desk research (Claude, 2026-11-02) against the official portals (gesetze-im-internet.de, ris.bka.gv.at) where they were reachable, otherwise against consolidated-text mirrors that cite RIS. The founder accepts this method for the risk-module reference catalogue. Each row records which method was used.

This file replaces `SLD_P3_LEGAL_CATALOGUE_DRAFT.md` as the input for P3. CC: follow the build instructions at the end.

---

## 1. Corrections to the draft (apply these, ignore the old URLs)

| Row | Problem in draft | Correct value |
|---|---|---|
| AT-3 DOK-VO | Wrong Gesetzesnummer 10009152 | **10009021** |
| AT-6 AStV | Wrong Gesetzesnummer 10008973 | **10009098** |
| AT-7 AM-VO | Wrong Gesetzesnummer 10009155 | **20000727** |
| CH-2 VUV | Art. 3 is not a "duty to assess risks" | Art. 3 Schutzmassnahmen und Schutzeinrichtungen; Art. 5 PSA; Art. 6 Information und Anleitung |

---

## 2. Approved rows — seed these

Seed with `verifiedBy = "Colin Buzoianu"`, `verifiedAt = 2026-11-02`. Add a `verificationMethod` column (text) and set it from the last column below: `official` = Stand read from the official portal; `mirror` = paragraph and version confirmed via a consolidated-text mirror citing RIS; `seed-check` = CC must read the Stand line from the official page at seed time and **skip the row if it can't** (no blank or guessed Stand ever gets seeded).

### Austria (AT)

| # | Reference | Obligation (short, our wording) | sourceUrl | consolidatedVersion | Method |
|---|---|---|---|---|---|
| AT-1 | ASchG §4 | Ermittlung und Beurteilung der Gefahren und Festlegung von Maßnahmen (Arbeitsplatzevaluierung), einschließlich arbeitsbedingter psychischer Belastungen | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=4 | §4 idF BGBl. I Nr. 118/2012, in force 01.01.2013 | mirror |
| AT-2 | ASchG §5 | Dokumentation der Evaluierung in Sicherheits- und Gesundheitsschutzdokumenten | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=5 | — | seed-check |
| AT-3 | DOK-VO | Form und Inhalt der Sicherheits- und Gesundheitsschutzdokumente | https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009021 | BGBl. Nr. 478/1996 idF BGBl. II Nr. 53/1997 | official |
| AT-4 | ASchG §14 | Unterweisung der Arbeitnehmer (nachweislich, während der Arbeitszeit, zu festgelegten Anlässen) | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=14 | §14 idF BGBl. I Nr. 159/2001, in force 01.01.2002 | mirror |
| AT-5 | ASchG §§73 ff. | Bestellung von Sicherheitsfachkräften und Arbeitsmedizinern (Präventivdienste) | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=73 | §73 idF BGBl. I Nr. 147/2006, in force 12.08.2006 | mirror |
| AT-6 | AStV | Anforderungen an Arbeitsstätten | https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009098 | BGBl. II Nr. 368/1998; latest amendment to read at seed (at least BGBl. II Nr. 324/2014) | seed-check |
| AT-7 | AM-VO | Schutz der Arbeitnehmer bei der Benutzung von Arbeitsmitteln | https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=20000727 | BGBl. II Nr. 164/2000; last amended Dec 2024, read the BGBl number at seed | seed-check |

### Germany (DE)

| # | Reference | Obligation (short, our wording) | sourceUrl | consolidatedVersion | Method |
|---|---|---|---|---|---|
| DE-1 | ArbSchG §5 | Beurteilung der Arbeitsbedingungen (Gefährdungsbeurteilung), je nach Art der Tätigkeiten | https://www.gesetze-im-internet.de/arbschg/__5.html | zuletzt geändert durch Art. 7 G v. 22.12.2025 I Nr. 369 | official |
| DE-2 | ArbSchG §6 | Dokumentation der Gefährdungsbeurteilung | https://www.gesetze-im-internet.de/arbschg/__6.html | as DE-1 | official |
| DE-3 | ArbSchG §5 Abs. 3 Nr. 6 | Psychische Belastungen bei der Arbeit als Gefährdungsfaktor | https://www.gesetze-im-internet.de/arbschg/__5.html | as DE-1 | official |
| DE-4 | ArbSchG §12 | Unterweisung der Beschäftigten | https://www.gesetze-im-internet.de/arbschg/__12.html | as DE-1 | official |
| DE-7 | ASiG | Bestellung von Betriebsärzten und Fachkräften für Arbeitssicherheit | https://www.gesetze-im-internet.de/asig/ | — | seed-check |
| DE-8 | ArbStättV | Einrichten und Betreiben von Arbeitsstätten (konkretisiert durch ASR) | https://www.gesetze-im-internet.de/arbst_ttv_2004/ | Art. 10 G v. 27.3.2024 I Nr. 109 (confirm nothing newer at seed) | official |
| DE-9 | BetrSichV | Gefährdungsbeurteilung und Schutzmaßnahmen bei der Verwendung von Arbeitsmitteln | https://www.gesetze-im-internet.de/betrsichv_2015/ | zuletzt geändert durch Art. 27 G v. 18.12.2025 I Nr. 347 | official |
| DE-10 | LärmVibrationsArbSchV | Gefährdungsbeurteilung bei Lärm und Vibrationen (limit values are a separate later catalogue) | https://www.gesetze-im-internet.de/l_rmvibrationsarbschv/ | zuletzt geändert durch Art. 3 V v. 21.7.2021 I 3115 | official |
| DE-11 | PSA-BV | Auswahl, Bereitstellung und Benutzung persönlicher Schutzausrüstung, Unterweisung | https://www.gesetze-im-internet.de/psa-bv/ | geändert durch Art. 2 V v. 2.12.2024 I Nr. 384 | official |

---

## 3. Deferred rows — do NOT seed now

| # | Reference | Why deferred | Revisit when |
|---|---|---|---|
| AT-8 | PSA-V (BGBl. II Nr. 77/2014) | RIS Gesetzesnummer not confirmed, and a replacement "PSA-VO" was in Begutachtung in 2026 | P6 (PPE catalogue), after checking whether PSA-VO is in force |
| DE-5 | DGUV Vorschrift 1 | No stable direct document URL or edition confirmed | Next DE pass |
| DE-6 | DGUV Vorschrift 2 | Same | Next DE pass |
| CH-1 … CH-8 | VUV, EKAS 6508, ArGV 3/4, ArG, UVG | CH stays positioning-only until its limit values and revDSG framing are done; ArGV 4 ELI also unconfirmed | CH pass |

The AT/DE hub and documents work without these rows. Where a deferred reference would appear, show it as an honest gap per §3.15, never a placeholder citation.

---

## 4. Build instructions for CC (P3 remainder)

1. **Catalogue model + seed.** Build `LegalReferenceCatalogVersion` + `LegalReference` as drafted (country, module/domain, code, short obligation text, `sourceUrl`, `consolidatedVersion`, `verifiedAt`, `verifiedBy`), **plus `verificationMethod`** (`official` / `mirror` / `seed-check`). Single-active-version, fail-closed, same pattern as `ExposureLimitCatalogVersion`. Seed §2 rows only. For `seed-check` rows, fetch the official page during seeding, record the Stand/Fassung line as `consolidatedVersion` and set the method to `official`. If the page can't be read, skip that row and list it in your report. Hand-written migrations, enum-only first where needed, RLS on new tables.
2. **ERGO doc update.** In `ERGO_COMPLIANCE_BY_DESIGN.md` §3.19 / §4, allow founder-approved delegated verification, as long as the method is recorded per row in `verificationMethod`. Bump the revision.
3. **CountryPack `de`.** Populate the DE terminology (Gefährdungsbeurteilung, Dokumentation der Gefährdungsbeurteilung, Fachkraft für Arbeitssicherheit, Betriebsarzt, Unterweisung, Betriebsrat, de-DE spelling) and the legal references from the catalogue. Set `verified: true`. **`ch` stays `verified: false`.**
4. **Generalise hub + statutory document to DE.** Read references and terminology by `Site.country`, fail-closed, no cross-country fallback. Add the DE template variant "Dokumentation der Gefährdungsbeurteilung (§ 6 ArbSchG)", gated on `pack.verified && templateVariant != null` exactly like the AT SGD. The CH variant stays unbuilt; a CH site shows the honest gap.
5. **Demo sites.** Add a DE demo site (fully working) and a CH demo site (shows the fail-closed gap) to the demo fixture. Keep reset/seed idempotent.
6. **Verify.** tsc/Biome/Vitest green. German walkthrough over HTTP on the AT and DE demo sites. Render the DE statutory PDF and check its text. Report seeded row count and any skipped `seed-check` rows.
7. Then continue with **P4** per `SLD_RESTRUCTURE_PLAN_platform-modules.md`.
