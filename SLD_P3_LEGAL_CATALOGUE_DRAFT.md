# SLD P3 — DACH legal catalogue draft (risk module) — FOR FOUNDER VERIFICATION

**Status: DRAFT. Nothing here is seeded.** Per `ERGO_COMPLIANCE_BY_DESIGN.md` §3.19 / §4 ("Never seed a DE or CH legal reference … the founder has not verified against the official consolidated text") and `SLD_RESTRUCTURE_PLAN_platform-modules.md` §11 P3 ("draft the §4.2 catalogue rows … and stop for my verification before seeding or writing UI text"), these rows are drafted from the plan's §4.2 map + a web check of the official portals, but **must be confirmed against the consolidated text by the founder before any of it is seeded or rendered**.

How to use this: for each row, open the source URL, confirm the reference still exists and its wording, fill in the **Consolidated version (Stand/Fassung)** date, and mark **Verify** ✅/✏️(correct)/❌(drop). I then seed only the ✅ rows, each carrying its source URL + consolidated-version date + your name/date as `verifiedBy`/`verifiedAt`.

Scope of this draft: the **risk module** (Gefährdungsbeurteilung / Evaluierung) only — the references the hub and the statutory document cite. Exposure *limit values* (noise/vibration numbers) are a separate, already-built catalogue (`ExposureLimit`, AT-only, VOLV-verified in B4); DE/CH limit numbers are their own later verification pass, not this one. Other modules (chemicals, incidents, training, legal register) get their own drafts in their phases.

Portals: **AT** → RIS `ris.bka.gv.at`. **DE** → `gesetze-im-internet.de` (statutes/ordinances) and `publikationen.dguv.de` (DGUV accident-insurer rules). **CH** → `fedlex.admin.ch` (federal law), `ekas.admin.ch` (EKAS guidelines), `suva.ch` (Suva limit lists).

---

## Austria (AT) — already the flagship; re-confirm consolidated dates

| # | Reference | Obligation (short) | Source URL (confirm) | Stand | Verify |
|---|---|---|---|---|---|
| AT-1 | ASchG §4 | Duty to evaluate hazards (Ermittlung und Beurteilung der Gefahren), incl. arbeitsbedingte psychische Belastungen | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=4 | | |
| AT-2 | ASchG §5 | Duty to document the evaluation (Sicherheits- und Gesundheitsschutzdokumente) | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=5 | | |
| AT-3 | DOK-VO | Form/content of the SGD | https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009152 | | |
| AT-4 | ASchG §14 | Information & instruction of workers (Unterweisung) | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=14 | | |
| AT-5 | ASchG §§73 ff. | Sicherheitsfachkräfte / Arbeitsmedizin (expert personnel) | https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008910&Paragraf=73 | | |
| AT-6 | AStV | Arbeitsstättenverordnung (workplaces) | https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008973 | | |
| AT-7 | AM-VO | Arbeitsmittelverordnung (work equipment) | https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009155 | | |
| AT-8 | PSA-V | Verordnung persönliche Schutzausrüstung | https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10009156 | | |

*(AT Gesetzesnummern above are my best-effort — RIS returned 503 to the earlier automated checks, so please confirm each resolves to the right norm; ASchG = 10008910 is the one already used for the exposure-limit work.)*

## Germany (DE) — all unverified; CountryPack `de` is a `verified:false` stub

| # | Reference | Obligation (short) | Source URL (confirm) | Stand | Verify |
|---|---|---|---|---|---|
| DE-1 | ArbSchG §5 | Beurteilung der Arbeitsbedingungen (duty to assess) | https://www.gesetze-im-internet.de/arbschg/__5.html | | |
| DE-2 | ArbSchG §6 | Dokumentation der Gefährdungsbeurteilung | https://www.gesetze-im-internet.de/arbschg/__6.html | | |
| DE-3 | ArbSchG §5 Abs. 3 Nr. 6 | psychische Belastungen explicitly in scope | https://www.gesetze-im-internet.de/arbschg/__5.html | | |
| DE-4 | ArbSchG §12 | Unterweisung (instruction) | https://www.gesetze-im-internet.de/arbschg/__12.html | | |
| DE-5 | DGUV Vorschrift 1 | Grundsätze der Prävention (incl. §4 Unterweisung) | https://publikationen.dguv.de/ (search "DGUV Vorschrift 1") | | |
| DE-6 | DGUV Vorschrift 2 | Betriebsärzte und Fachkräfte für Arbeitssicherheit | https://publikationen.dguv.de/ (search "DGUV Vorschrift 2") | | |
| DE-7 | ASiG | Gesetz über Betriebsärzte/Sifa (expert personnel) | https://www.gesetze-im-internet.de/asig/ | | |
| DE-8 | ArbStättV | Arbeitsstättenverordnung (+ ASR technical rules) | https://www.gesetze-im-internet.de/arbst_ttv_2004/ | | |
| DE-9 | BetrSichV | Betriebssicherheitsverordnung (work equipment) | https://www.gesetze-im-internet.de/betrsichv_2015/ | | |
| DE-10 | LärmVibrationsArbSchV | Lärm/Vibration (risk-assessment duty; limit values are a later pass) | https://www.gesetze-im-internet.de/l_rmvibrationsarbschv/ | | |
| DE-11 | PSA-BV | PSA-Benutzungsverordnung | https://www.gesetze-im-internet.de/psa-bv/ | | |

## Switzerland (CH) — all unverified; CountryPack `ch` is a `verified:false` stub; revDSG not GDPR

| # | Reference | Obligation (short) | Source URL (confirm) | Stand | Verify |
|---|---|---|---|---|---|
| CH-1 | VUV Art. 11a ff. (SR 832.30) | Beizug von Arbeitsärzten/Spezialisten der Arbeitssicherheit (ASA), hazard assessment basis | https://www.fedlex.admin.ch/eli/cc/1983/1968_1968_1968/de | | |
| CH-2 | VUV Art. 3–6 (SR 832.30) | Employer duty to assess risks, PPE (Art. 5), instruction (Art. 6) | https://www.fedlex.admin.ch/eli/cc/1983/1968_1968_1968/de | | |
| CH-3 | EKAS-Richtlinie 6508 | ASA-Beizugspflicht / Sicherheitssystem (the de-facto "how" of CH risk assessment) | https://www.ekas.admin.ch/ (Richtlinie 6508) | | |
| CH-4 | ArGV 3 Art. 2 ff. (SR 822.113) | Gesundheitsvorsorge — employer duty to protect health | https://www.fedlex.admin.ch/eli/cc/1993/2553_2553_2553/de | | |
| CH-5 | ArGV 3 Art. 5 (SR 822.113) | Instruction/information of workers | https://www.fedlex.admin.ch/eli/cc/1993/2553_2553_2553/de | | |
| CH-6 | ArGV 4 (SR 822.114) | Betriebe, Plangenehmigung (workplaces/equipment) | https://www.fedlex.admin.ch/eli/cc/1993/2559_2559_2559/de | | |
| CH-7 | ArG (SR 822.11) | Arbeitsgesetz — framework | https://www.fedlex.admin.ch/eli/cc/1966/57_57_57/de | | |
| CH-8 | UVG (SR 832.20) | Unfallversicherungsgesetz — basis of VUV | https://www.fedlex.admin.ch/eli/cc/1982/1676_1676_1676/de | | |

*(CH fedlex ELIs are the standard consolidated-text links by SR number; please confirm each opens the current "Fassung in Kraft". The SR numbers themselves — VUV 832.30, ArGV 3 822.113, ArGV 4 822.114, ArG 822.11, UVG 832.20 — are the identifiers to search on fedlex if an ELI drifts.)*

---

## What I'll build once you've verified (P3 remainder)

1. **Country legal-catalogue model** — `LegalReferenceCatalogVersion` + `LegalReference` (country, module/domain, code, short obligation text, `sourceUrl`, `consolidatedVersionDate`, `verifiedAt`, `verifiedBy`), the fail-closed single-active-version pattern like `ExposureLimitCatalogVersion`. Seed **only verified rows**, AT first, then DE/CH.
2. **CountryPack DE/CH** — once the references are confirmed, populate `de`/`ch` terminology + `legalReferences` and flip `verified: true` (DE first; CH stays positioning-only until its limit values + revDSG framing are also done, per ERGO §5's open CH item).
3. **Generalise the hub + statutory document generator to DE/CH** — the Evaluierung hub reads its legal references + terminology from the pack/catalogue by `Site.country`; the statutory-document generator gets DE (Dokumentation der Gefährdungsbeurteilung) and CH (EKAS-6508-shaped) template variants, each gated on `pack.verified && templateVariant != null` exactly like the AT SGD. No cross-country fallback (§3.15).
4. **DE + CH demo sites** — added to the demo fixture so the country behaviour is demonstrable; until a country's pack is verified, its legal features fail closed (honest gap), which is the correct §3.15 behaviour.

**Please mark the Verify column (and fill Stand dates) for the rows above — I seed only what you approve.**
