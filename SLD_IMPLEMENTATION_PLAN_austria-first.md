# SLD implementation plan — Austria first, camera last

**Working spec for Claude Code.** Read `ERGO_COMPLIANCE_BY_DESIGN.md` and `CLAUDE.md` first; this document assumes both and does not repeat their mandates.

**Relationship to `SLD_IMPLEMENTATION_PLAN_demo-loop.md`:** that plan is *done* (M0–M8 all landed) and stays in the repo as the record of how the register/action loop was built. This document does not supersede its architecture — it supersedes its **priority order and its market framing**. Where the two disagree about what to build next, this one wins. Where they disagree about a mandate, `ERGO_COMPLIANCE_BY_DESIGN.md` wins over both.

**Two things are being deliberately put down**, not abandoned, and CC must not quietly pick either back up:

1. **The 3D posture editor / skeleton fidelity work.** `SLD_POSTURE_EDITOR_FIDELITY_PLAN.md` is **frozen**. Do not open it, do not improve `draw-skeleton.ts` visuals, do not propose FK/IK work. Unfreeze condition is written in §9 below.
2. **Camera capture as the primary input path.** It keeps working — it is a shipped, field-pilot-validated path and a regression there is a regression. But it stops being the thing the product is demonstrated on, and it stops being the thing new features are built around.

---

## 1. The reframe, stated honestly

`SLD_IMPLEMENTATION_PLAN_demo-loop.md` §14 says: *"The moat is camera-based ergonomic scoring… the risk register and action tracking are table stakes."* If the camera is demoted, that sentence stops being true, and pretending otherwise would leave SLD as a generic EHS register competing head-on with Quentic, iManSys, EcoOnline and a dozen Austrian Sicherheitsfachkraft consultancies with their own Excel templates. That is a losing fight.

So the moat has to be re-anchored, explicitly, before any code:

> **The differentiator is a country-scoped, version-pinned, fully traceable assessment record that produces the legally required document — and then proves, against a re-assessment, that the measures actually worked.**

Every clause there is already load-bearing in this codebase and none of it needs a camera:

| Clause | What already implements it |
|---|---|
| country-scoped | *nothing yet* — this is §4, the one genuine gap |
| version-pinned | `MethodologyVersion` / `RiskMatrixVersion`, fail-closed, single-active, DB-enforced |
| fully traceable | `ActionStatusEvent` append-only, `PostureSampleValidationEvent`, per-assessment `matrixVersion` never recomputed against "whatever is active now" |
| the legally required document | three PDF generators already exist and share one pattern — the fourth is §7 |
| proves measures worked | `transitionAction` → `VERIFIED` requires a `verificationOutcome` **plus** a verification assessment or explicit note. This is still the single best thing in the product. |

The camera then becomes what it should have been commercially all along: **an optional evidence-quality upgrade on an input the tool accepts either way**, not the reason to buy. That is a much easier sale and a much smaller support surface.

**Update `CLAUDE.md`'s status section and the demo-loop plan's §14 to say this.** Leaving a stale "the moat is the camera" line in a doc CC reads on every session will cause drift.

---

## 2. Why Austria, concretely

Not sentiment — three structural facts, all verifiable in RIS and on arbeitsinspektion.gv.at:

**(a) The document is legally named and legally shaped.** Austria doesn't just require a risk assessment; it requires the results to be recorded in **Sicherheits- und Gesundheitsschutzdokumente (SGD)** under **§5 ASchG** and the **DOK-VO** (Verordnung über die Sicherheits- und Gesundheitsschutzdokumente). The DOK-VO prescribes its shape. Two of its requirements are things this codebase already does and most competitors do badly:

- it must be recorded **who** performed the evaluation and **when** it was performed or adapted — that is `ActionStatusEvent` / assessment status transitions / `PlatformUser`;
- where ÖNORMEN, harmonised European standards (EN / ÖNORM EN), ÖVE rules or other recognised technical rules were used to derive measures, **those standards must be named in the SGD** — SLD's whole scoring design is "every number traces to a named public standard" (ISO 11228, EN 1005). Most tools cannot produce this line at all.

So the target artifact isn't "a report." It's **a DOK-VO-conformant SGD**. That's a named thing an Arbeitsinspektor asks for by name, which makes it a purchase justification rather than a nice-to-have.

**(b) The buyer already has a legally mandated budget.** **§82a ASchG** sets Präventionszeit per employee per calendar year (1.2 h for office-type workplaces, 1.5 h for others). Of that, Sicherheitsfachkräfte get ≥40%, Arbeitsmediziner ≥35%, and **the remaining ≥25% must go to "sonstige geeignete Fachleute" — the statute names Ergonomen and, emphatically, Arbeitspsychologen.** Austrian employers are legally required to spend money on exactly the two things this roadmap builds. The sales question is not "can you afford this," it's "what are you currently doing with your 25%."

**(c) Ergonomics has a legal obligation with no prescribed method.** **§64 ASchG** requires manual load handling to be evaluated (load characteristics, required physical effort, work environment, task requirements) — but Austria has **no Lastenhandhabungsverordnung**. A ministry draft has sat unimplemented since 2002. In its absence the Arbeitsinspektion publishes Last-Handhabungs-Tabellen and the Leitmerkmalmethode circulates as Stand der Technik. An obligation with no mandated method is the best possible opening for a documented, version-pinned, standards-cited method. Contrast Germany, where the LMM is more entrenched and "why isn't this just the LMM" is the first question in the room.

**(d) Psychosocial is not optional here.** Since the 2013 ASchG amendment, arbeitsbedingte psychische Belastungen must be evaluated as part of the Arbeitsplatzevaluierung (§2 Z 7a defines Gesundheit as physical *and* mental; §§4, 5, 7 carry the obligation), the Arbeitsinspektion audits it, and the results go in the SGD. The demo-loop plan deferred psychosocial. **For Austria, deferring it means the SGD is incomplete on the exact axis the inspectorate has been leaning on for a decade.** It moves up the roadmap — see §7 B7.

**Anti-goal:** do not start writing Austrian legal advice into the product. SLD documents an employer's own evaluation; it does not opine on their compliance. Same line §1 of the compliance doc already draws for AI Act framing.

---

## 3. What actually converts — features ranked

CC should treat this table as the priority tiebreaker whenever two pieces of work look equally reasonable.

| Rank | Feature | Why it converts in AT | State |
|---|---|---|---|
| 1 | **SGD generator (DOK-VO-shaped PDF, de-AT)** | The named legal artifact. Replaces the binder, not just the clipboard. | Build (B5) |
| 2 | **Effectiveness verification loop** | Nothing else on the market shows a band *falling* against a re-assessment with an audit trail. Already built — it just isn't *visible*. | Promote (B6) |
| 3 | **Country-correct exposure limits, two-tier** | AT's noise limit is **85 dB**, not 87. Getting this right in the room is a five-second credibility proof; getting it wrong is fatal. | Build (B1/B4) |
| 4 | **Manual assessment entry** | Removes the camera from the critical path. Lets an SFK use the tool on day one with a tape measure and a goniometer app. Unblocks every scoring feature below. | Build (B2) |
| 5 | **Floor plan with risk-banded pins** | Already built and buried. It is the single most immediately legible screen in the product. | Promote (B6) |
| 6 | **Psychosocial evaluation module** | Legally required, audited, and funded out of the §82a 25%. | Build (B7) |
| 7 | **Hold-time / duration scoring** | Closes the "a 2-second reach scores like a 4-hour bend" hole that any real ergonomist spots in minute three. | Build (B3) |
| 8 | **Manual handling scoring (§64)** | Obligation with no mandated method — SLD supplies one, cited. | Build (B8) |
| 9 | Reach envelope / geometry | Real, but observer-rateable today. Low urgency without the 3D work. | Later (B9) |
| 10 | Camera capture | Evidence-quality upgrade, differentiator in demos *later*. | Last (B10) |

**What is deliberately not on this list, and stays off it:** separate scored factors for PPE burden and environmental hygiene (already expressible as `RiskFinding` + notes — duplicating structure for marginal gain), multi-workstation benchmarking, emailing/scheduling reports, and any new capture modality.

---

## 4. Country architecture — the one real schema decision

### 4.1 Country is not locale. Do not merge them.

The existing `Locale` (`en`/`de`/`ro`, cookie-based, no URL prefix, `src/lib/i18n/locale.ts`) answers *"what language is this person reading in."* It stays exactly as it is.

Country answers three different questions, on three different objects:

| Question | Lives on | Consumer |
|---|---|---|
| Which market is this marketing page addressed to? | the **URL** | public site, SEO, lead routing |
| Which legal limits and references apply to this data? | **`Site.country`** | limit catalog, SGD generator, exposure evaluation |
| Which words does this market use for the same concept? | a **country pack** | UI copy inside German |

That third row is not a detail. In de-AT it is *Evaluierung*, *Sicherheits- und Gesundheitsschutzdokument*, *Arbeitsinspektion*, *AUVA*, *Sicherheitsvertrauensperson*. In de-DE the same concepts are *Gefährdungsbeurteilung*, *Dokumentation der Gefährdungsbeurteilung*, *Gewerbeaufsicht/Amt für Arbeitsschutz*, *Berufsgenossenschaft*, *Sicherheitsbeauftragter*. Using the German words in Vienna reads as a German vendor who didn't do the homework — which is precisely the objection Austrian buyers raise about German SaaS.

**Decision: do not add a fourth locale (`de-AT`).** Terminology that varies by country goes in a **country pack** (`src/lib/country/packs/{at,de,ch}.ts`) that overrides specific keys, resolved *after* the locale dictionary. This mirrors the existing per-area dictionary independence rather than doubling the dictionary matrix. A country pack holds: terminology overrides, legal reference strings, the SGD template variant, and the enforcement-body name.

### 4.2 URLs

```
src/app/(marketing)/[country]/page.tsx        /at, /de, /ch
src/app/(marketing)/[country]/about/page.tsx
src/app/(marketing)/[country]/legal/page.tsx
src/app/(marketing)/page.tsx                  /  → country chooser (NOT a redirect)
```

- `country` is a static param set — `generateStaticParams` over `["at","de","ch"]`, anything else `notFound()`. No open-ended segment.
- `/` stays a real page with explicit links, plus `<link rel="alternate" hreflang="…">` across the three. Do **not** geo-redirect: it breaks crawlers, breaks link sharing, and an Austrian prospect forwarded a `/de` link should land on `/de` and see German framing, not be silently bounced.
- The existing `/`, `/about`, `/legal` content becomes `/at/*` first. `/de` and `/ch` ship as the same shell with country-pack copy and an honest "in Vorbereitung" note on anything not yet legally verified for that market — **an unverified legal claim on the Swiss page is worse than an empty Swiss page.**
- Visiting `/at` sets the locale cookie to `de` **only if no locale cookie exists yet**. An explicit language choice always wins. Never overwrite it.
- CH note: the marketing page can exist now, but Swiss OSH sits under ArG/UVG with SUVA/SECO and its own Grenzwerte (and revDSG rather than GDPR for the privacy copy). Ship `/ch` as a positioning page only. **Do not seed Swiss limit values without verifying against the SUVA Grenzwert-Liste** — a wrong Swiss number seeded from a German source is exactly the failure mode this whole section exists to prevent.

### 4.3 `Site.country`

New `CountryCode` enum (`AT`, `DE`, `CH`, `RO`). Per the standing gotcha, **enum-only migration first**, then the column.

`Site.country CountryCode NOT NULL`, backfilled explicitly in the migration (`RO` for the dev fixture company, `AT` for the demo company) — never left to ride on a column default, same discipline as `AssessmentSession.mode`.

`Company` does **not** get a country. A company can have sites in more than one country and the whole point is that the legal frame follows the physical site.

### 4.4 Two-tier limits — an actual schema defect to fix

`ExposureMeasurement` currently has one `limitValue` + `limitReference`. Austrian noise/vibration law is **two-tier** and the tiers trigger different obligations:

| Parameter | Auslösewert (VOLV §4) | Expositionsgrenzwert (VOLV §3) |
|---|---|---|
| Lärm, LA,EX,8h | 80 dB | **85 dB** |
| Lärm, LC,peak | 135 dB | 137 dB |
| Hand-Arm-Vibration, ahw,8h | *verify §4* (EU-Richtlinie 2002/44/EG: 2,5 m/s²) | 5 m/s² |
| Ganzkörper-Vibration, aw,8h | *verify §4* (EU-Richtlinie 2002/44/EG: 0,5 m/s²) | 1,15 m/s² |

Two consequences:

1. **The demo fixture is wrong for Austria.** `seed-demo-fixture.mjs` and the demo-loop plan's §1 step 7 use "89 dB(A) against the 87 dB(A) limit." 87 dB is the EU directive's limit value *with hearing protection attenuation taken into account*; Austria's VOLV sets the Expositionsgrenzwert at 85 dB and the Auslösewert at 80 dB, and explicitly excludes PPE effect when assessing the Auslösewerte. Change the fixture to **89 dB(A) against an 85 dB(A) Expositionsgrenzwert, with the 80 dB(A) Auslösewert already exceeded** — which is a *better* demo beat anyway, because it shows two thresholds crossing at once.
2. **Add the second threshold to the model**, don't fake it in the UI:
   - `ExposureMeasurement.actionValue Float?` + `actionValueReference String?`
   - `ExposureMeasurement.exposureLimitId String?` — nullable FK to the catalog row that supplied both, so a measurement records *which version of which catalog* it was judged against. Same reasoning as `RiskAssessment.matrixVersion` never being recomputed against "whatever is active now."

### 4.5 The limit catalog

Mirror `MethodologyVersion` exactly. No new patterns.

```
ExposureLimitCatalogVersion  version (PK), label, isActive, activatedAt
  → hand-added partial unique index on isActive WHERE isActive = true
  → getActiveExposureLimitCatalog() fails closed on zero active rows

ExposureLimit  id, catalogVersion, country CountryCode, hazardCategory,
               parameterKey, parameterLabel, unit,
               actionValue Float?, limitValue Float?,
               legalReference, legalReferenceUrl, notes
  → @@unique([catalogVersion, country, parameterKey])
```

`lookupExposureLimits(country, hazardCategory)` follows `lookupScoringRule`'s split: a pure matcher unit-tested against in-memory rows, plus the impure fetch. Returns `[]` on no match — **never a fallback to another country's values.** A missing Austrian limit shows as "no limit configured for this parameter in AT," which is honest and fixable; silently showing a German number is a defect that ships to a customer.

Seed `v1-at-2026` with, at minimum:

| Category | Parameter | Reference |
|---|---|---|
| NOISE | LA,EX,8h / LC,peak | VOLV §§3–4 (BGBl. II Nr. 22/2006) |
| VIBRATION | ahw,8h (HAV) / aw,8h (WBV) | VOLV §§3–4 |
| LIGHTING | task-area illuminance by activity | AStV; ÖNORM EN 12464-1 |
| CLIMATE_THERMAL | thermal comfort / heat load | AStV; ÖNORM EN ISO 7730 |
| CHEMICAL | MAK / TRK | §45 ASchG; GKV |
| ERGONOMIC_MSD | *no numeric legal limit in AT* — reference only | §64 ASchG; ÖNORM EN 1005-2, EN ISO 11228-1 |

That last row is important and must be modelled, not omitted: an `ExposureLimit` with **both thresholds null and a legal reference present** is a legitimate state meaning *"the law requires this to be evaluated but sets no number."* The UI must render that as an obligation, not as an absence. It's also the exact hook the SGD needs, because DOK-VO wants the applied standards named.

**Verification bar for the seed:** every seeded row's `legalReference` must be checked against RIS (ris.bka.gv.at) or arbeitsinspektion.gv.at by a human before it ships, and the migration comment must say so. Do not let CC seed a legal value from its own recollection. Numbers marked *verify* in the table above are explicitly not cleared.

---

## 5. Manual entry — the thing that unlocks everything

The scoring engine is fully built and completely blocked behind a camera: 29 `ScoringRule` rows, 17 `BodyRegion`s, versioned, fail-closed, non-monotonic ELBOW/NECK handled correctly. Right now the *only* way to get a `PostureSample` is MediaPipe. That is why the product feels fragile in a presentation — a demo that depends on lighting, framing and a willing volunteer will fail in a meeting room eventually.

An ergonomist with a goniometer app and a tape measure should be able to produce a fully scored, fully traceable assessment with no camera in the room at all.

**Schema:**

- `PostureSampleSource` enum: `CAMERA_MEDIAPIPE` | `MANUAL_ENTRY` | `IMPORTED_MODEL` (the third reserved, no implementation — same discipline as `AssessmentMode.CONTINUOUS`, and `createPostureSample()` throws on it).
- `PostureSample.source PostureSampleSource NOT NULL`, existing rows backfilled explicitly to `CAMERA_MEDIAPIPE` in the migration.
- `PostureSample.keypoints` becomes nullable, with a **hand-added CHECK** enforcing shape by source (`keypoints IS NOT NULL` when `CAMERA_MEDIAPIPE`, `IS NULL` when `MANUAL_ENTRY`) — copy `ManualInput_value_shape_check` as the pattern.
- Manual entry writes `BodyRegionScore` rows directly from entered angles.

**The thing not to break:** `buildRegionResults()` currently recomputes from stored `keypoints`. For `MANUAL_ENTRY` samples there are none. Do **not** make `buildRegionResults` invent a fallback — give it an explicit branch that reads the persisted `BodyRegionScore` rows for manual samples and returns the same `RegionResult` shape, with `wrong-camera-angle` / `insufficient-visibility` simply not applicable. The response shape in `src/lib/capture/types.ts` does not change; a fourth consumer of the same shape is exactly what that note in `CLAUDE.md` anticipated.

**UI:** a "Manual entry" tab alongside "Capture" on `(app)/tasks/[taskId]`. Per-region angle inputs in flexion-from-neutral convention (0° = neutral, increasing = more flexed — the existing convention, do not introduce a second one), each showing its resulting band live as it's typed. That live band feedback is, in practice, a better demo than the skeleton ever was: the assessor sees the methodology reason in front of them.

**Report/PDF consequence:** every generated artifact must state the sample source. A manually entered angle and a camera-derived angle are not equally strong evidence and the document must not blur them. One column, always present.

---

## 6. Hold time — where it belongs

Recording it: the earlier analysis stands. `DURATION_SECONDS` is a task-level `ManualInput`; ISO 11226 allowable holding time is **per posture**. Add `PostureSample.holdDurationSeconds Int?` and score against it. Leave `ManualInput.DURATION_SECONDS` alone (it means task cycle duration, a different quantity) and add a comment in the schema saying so, or the two will be conflated within a month.

Scoring it: **parallel sub-scores, not a blended composite.** Posture band (current, unchanged) and hold-time band (ISO 11226 allowable duration for the measured angle) as two independently traceable results, rolled up worst-of using the existing `RiskBand` vocabulary. Reasons, in order of how much they'll cost if ignored:

1. A blended multiplier chain is unattackable-looking right up until a Betriebsrat's expert asks where the coefficients come from, and then it is indefensible, because the honest answer is "we chose them."
2. Every sub-score traces to one named public standard, which is what DOK-VO wants named in the SGD.
3. A multiplier chain over posture × load × frequency is structurally an EAWS clone, which `ERGO_COMPLIANCE_BY_DESIGN.md` §3.7 forbids.

**Version the methodology as a whole, not per factor.** When posture + hold time + load are all scored, that is `v2-…`, one version covering all of them. Per-factor versioning turns `MethodologyVersion` from an audit anchor into a matrix nobody can reason about, and re-scoring a historical session becomes undefined.

---

## 7. Milestones

Lettered **B** so they never collide with the demo-loop plan's M-series in a commit message or a prompt.

| # | Milestone | Gate for |
|---|---|---|
| **B0** | Decisions + doc updates. No code. | CC reads these on every later session |
| **B1** | `CountryCode` + `Site.country` + country routes + country pack scaffold | B4, B5 |
| **B2** | Manual posture entry | B3, B8, and the whole presentation story |
| **B3** | Hold time on `PostureSample` + ISO 11226 sub-score | methodology `v2` |
| **B4** | Exposure limit catalog, two-tier, AT seed | B5 |
| **B5** | **SGD generator** | the sale |
| **B6** | Presentation layer: site map promotion + present mode | every demo from then on |
| **B7** | Psychosocial evaluation (AT-mandated) | SGD completeness |
| **B8** | Manual handling scoring (§64 / ISO 11228-1) | methodology `v2` completion |
| B9 | Reach envelope / geometry | — |
| B10 | Camera revisited: keep, or 3D model import | — |

### B0 — decisions and docs

No code. Produce:

- `ERGO_COMPLIANCE_BY_DESIGN.md` → **v1.17**, adding:
  - **§3.15** — jurisdiction scoping: every legal limit, threshold and statutory reference shown to a user is resolved from `Site.country` against a versioned catalog. No limit is ever displayed without its country and its legal reference. A missing limit fails visibly, never falls back to another country's value.
  - **§3.16** — input provenance: every scored posture records how it was obtained (`PostureSampleSource`), and every generated artifact states it. Camera-derived and manually entered values are never presented as interchangeable.
  - **§4 never-build additions**: never display a limit value without its jurisdiction and reference; never fall back across countries; never present a manually entered angle as a measured one.
  - **§5 new open item**: Swiss limit values and Swiss OSH framing (ArG/UVG, SUVA/SECO, revDSG) are unverified — `/ch` ships as positioning only until closed.
  - **§5 update** on the psychosocial minimum group size (below).
- **Locked decision, psychosocial, written now so it can't drift under commercial pressure later:** aggregates only, never per-respondent, never per-worker, no free-text verbatims stored. **Minimum group size 15** — this is not an invented number: the Austrian guidance (WKO/Arbeitsinspektion) holds that questionnaire instruments are unsuitable below 15 employees precisely because anonymity isn't preserved, and directs smaller operations to moderated group discussions instead. Below 15, SLD records the *result* of a group discussion as a finding; it does not collect responses. Enforce the 15 at the DB level with a CHECK, not in the UI.
- `CLAUDE.md`: rewrite the moat sentence per §1, add a **frozen work** section naming `SLD_POSTURE_EDITOR_FIDELITY_PLAN.md` and its unfreeze condition, note the new `(marketing)/[country]` structure.
- `SLD_POSTURE_EDITOR_FIDELITY_PLAN.md`: add a header — *frozen as of this plan, see §9.* Don't delete it.

### B1 — country foundation

Enum-only migration → `Site.country` with explicit backfill → `(marketing)/[country]` routes → country pack scaffold with AT populated, DE/CH stubs. Marketing copy for `/at` uses Austrian terminology throughout (Evaluierung, SGD, Arbeitsinspektion, AUVA, SVP). The `/legal` page is per-country: Austrian Offenlegung under ECG §5 differs from a German Impressum under DDG, and the Swiss page needs revDSG rather than GDPR framing. Reuse `/legal`'s existing verbatim-content rule — the current text was specified verbatim as compliance-sensitive; the AT variant is a **new** verbatim text to be reviewed, not a paraphrase CC produces on its own.

### B2 — manual posture entry

Per §5. Ends when a complete `RiskAssessment` with ergonomic findings can be produced start-to-finish with the camera never opened, and the PDF says so.

### B3 — hold time

Per §6. Bump to `v2-2026-…` covering posture + hold time together. Existing samples re-score correctly under `v1` — prove it, don't assume it.

### B4 — limit catalog

Per §4.4/§4.5. Prefill `limitValue`/`actionValue`/`limitReference` on the measurement entry form from `Site.country`. Nobody types 85 by hand again. Fix the demo fixture's 87 → 85/80.

### B5 — the SGD generator

`GET /api/sites/[siteId]/sgd` (or per-workstation — DOK-VO permits grouping comparable workplaces/activities, so support both scopes; the site-wide one is what gets shown to an inspector). Same `@react-pdf/renderer` + `renderToBuffer` + `createElement` Route Handler pattern as the three existing generators. Same zero-identity discipline. **German output for AT, and the country pack supplies the section headings** — this is the first artifact where English-only is not acceptable, because the reader is an Austrian inspector or SFK.

Content, driven by DOK-VO and §5 ASchG:

1. Betrieb / Arbeitsstätte identification, evaluation scope, date.
2. **Who performed the evaluation and when** — from the assessment's own status-transition history, not a free-text field.
3. Per workplace or activity group: identified Gefahren (`RiskFinding` + `Hazard`), the assessment (`RiskMatrixCell` + band), and existing controls.
4. Measurements against limits, with the Austrian legal reference per row and **both** thresholds where two exist.
5. Maßnahmen: the `Action` register with `HierarchyOfControl` level, responsible role, due date, status. §7 ASchG's Grundsätze der Gefahrenverhütung *are* a hierarchy of control — say so explicitly in the document; that mapping is a credibility line an SFK will notice.
6. **Applied standards and technical rules** — the ÖNORM EN / EN ISO list, generated from the methodology version's own rule set, not hardcoded. This is the DOK-VO requirement almost nobody can satisfy automatically, and it is the single strongest page in the document.
7. Verification of effectiveness — §4 Abs 4 ASchG requires measures be checked for effectiveness and adapted. That's `VERIFIED` with its evidence. This section is the product's whole argument in one page.
8. Review/adaptation history.

The footer disclaimer stays: this documents the employer's own evaluation and does not replace assessment by a qualified Sicherheitsfachkraft or Arbeitsmediziner.

### B6 — presentation layer

The complaint is that good work is invisible. Fix it as a feature, not as demo choreography:

- **Promote the floor plan.** `(app)/sites/[siteId]/map` exists and is buried. Make it the site page's default view, with markers coloured by each workstation's latest approved band and unassessed workstations visually distinct (not just uncoloured — an unassessed workstation is a finding in itself under §4 ASchG). Clicking a pin opens the workstation risk view. This is the screen that should be on the projector when the meeting starts.
- **Present mode.** `?present=1` on the existing read-only views: hide the app chrome, raise base type size, high contrast, keyboard `←`/`→` through a fixed sequence (site map → workstation risk → assessment detail → action detail → verification history → SGD). No new data paths, no new authorization — a presentation flag on views that already exist and already pass `requireSiteAccess`. If it needs new queries, it's out of scope.
- **Make the verification loop legible.** On the workstation risk view, the band trend needs a before → after visual with the action that caused it named between them. Right now the trend exists as data and the causal link is invisible. That link *is* the product.
- **`npm run reset:demo` reachable from the UI** for `super_admin` only, so a failed demo is recoverable in one click instead of a terminal.

### B7 — psychosocial

Austria mandates it (§§2 Z 7a, 4, 5, 7 ASchG), the Arbeitsinspektion audits it, and §82a funds it. Build it as **structured findings, not a survey platform** — SLD is not going to compete with arbeitspsychologische Erhebungsverfahren, and shouldn't try.

Model the four dimensions the Austrian guidance uses (aligned to ÖNORM EN ISO 10075-1/-3): Arbeitsaufgabe und Tätigkeit, Arbeitsorganisation und Arbeitsabläufe, Arbeitsumgebung, Sozial- und Organisationsklima. Per dimension, per workplace or activity group: an assessed band, the method used (questionnaire / group discussion / observation / interview — recorded, since the Arbeitsinspektion asks), the group size, and the derived measures. `PSYCHOSOCIAL` already exists in `HazardCategory`; findings hang off `RiskAssessment` like everything else and land in the SGD.

Hard constraints, DB-enforced: group size ≥ 15 CHECK, no per-respondent table anywhere in the schema, no free-text verbatim storage. Where an external Verfahren was used, SLD records *that it was used and what it concluded* — it does not ingest raw responses. That boundary is also the product's best answer to the works-council objection.

### B8 — manual handling

`LOAD_WEIGHT_KG` / `PUSH_FORCE_N` / `PULL_FORCE_N` are captured and read by nothing. Add a manual-handling sub-score against ISO 11228-1 / EN 1005-2 recommended mass limits — parallel and traceable, per §6, folded into the same `v2` methodology version. Cite §64 ASchG as the obligation and the ÖNORM EN as the method. Note in the SGD that Austria prescribes no method, and name the one used. That sentence is a selling point, not a hedge.

### B9 / B10 — later

Reach envelope (EN 1005-4, ISO 14738) computed from keypoints, **if** the camera path is revived; observer-rated otherwise. Split the row honestly — reach zone is computable, "visual space" and "fine motor skills" are observer ratings and always will be; don't let them ride into a CV pipeline pretending otherwise. Camera decision per §9.

---

## 8. Verification bar

Same standard the repo already holds, plus two additions specific to this plan:

- Every migration: re-verify hand-added constraints against the live DB, confirm RLS enabled, confirm no unintended `DROP CONSTRAINT`.
- **Prove the new CHECKs reject** at the database level: a `MANUAL_ENTRY` sample with keypoints, a `CAMERA_MEDIAPIPE` sample without, a psychosocial finding with group size 14.
- **Prove the limit lookup fails closed**: a `Site` with `country = CH` and no Swiss catalog rows shows "no limit configured," never an Austrian or German number. Test this explicitly — it is the single defect in this plan that would most damage a customer.
- `npm test` green; Biome clean.
- **The full walkthrough, camera never opened**, against a running server: sign in → site map → workstation → manual posture entry → scored bands → exposure measurement prefilled from AT limits and flagged over both thresholds → action raised → implemented → re-assessed → verified → band drops → SGD generated in German with the correct legal references. Parse the generated PDF and assert the specific Austrian strings are present — same `pdfjs-dist` verification pattern already used for the other three artifacts, not "it returned 200."
- **Desktop and phone camera capture still work.** They are shipped, field-validated paths. Demotion is a priority decision, not permission to regress them.

---

## 9. Frozen, and how to unfreeze

**`SLD_POSTURE_EDITOR_FIDELITY_PLAN.md` — frozen.** No FK/IK work, no skeleton rendering improvements, no 3D editor. The honest reason: the visual fidelity gap is a character-modelling and rigging problem, and solving it properly means either a real rigged human mesh with proper weight painting or a licensed avatar system. Iterating on hand-rolled geometry has already consumed disproportionate time for a component that is *decorative* — no scoring decision depends on how the skeleton looks. Bands and numbers carry the entire methodology.

**Unfreeze conditions — any one:**
- a paying customer asks for visual posture representation specifically (not "it'd be nice"), or
- the work becomes buying a rigged model rather than building one, or
- B0–B7 are shipped and there is genuinely nothing higher-value left.

**Camera capture — kept, demoted.** It stays working and stays in the product; it stops being the demo spine and stops receiving new features. When B10 comes up, the decision is between exactly two options, taken deliberately:

- **(a) Keep MediaPipe as an evidence-quality upgrade.** Positioned as "faster and more objective than a goniometer, on the same methodology," with the existing honest failure modes intact. Lowest cost — it already works.
- **(b) Import a rigged 3D model and drive it from captured or entered angles.** Solves the fidelity complaint and the manual-entry visualisation at once, but it's a real dependency decision (licensing, bundle size, WASM/WebGL support on the low-end machines EHS staff actually use) and belongs in `ERGO_COMPLIANCE_BY_DESIGN.md` §5 as an open prerequisite before any code.

Do not do both. Do not start either before B7.

---

## 10. CC prompt sequence

One per milestone. Front-load what CC can't infer.

**B0**
> Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md` and `SLD_IMPLEMENTATION_PLAN_austria-first.md` fully. No code this step. Update the compliance doc to v1.17 per B0 in the Austria-first plan: add mandates 3.15 (jurisdiction scoping, fail-visible, no cross-country fallback) and 3.16 (input provenance), the matching §4 never-build entries, a §5 open item for unverified Swiss limits and Swiss OSH framing, and the psychosocial minimum-group-size decision with its Austrian rationale. Then update `CLAUDE.md`: replace the "moat is the camera" framing per §1 of the plan, add a frozen-work section covering `SLD_POSTURE_EDITOR_FIDELITY_PLAN.md` with its unfreeze conditions, and note the coming `(marketing)/[country]` structure. Add a freeze header to the posture fidelity plan; don't delete it.

**B1a**
> Hand-write a migration adding **only** the `CountryCode` Postgres enum (`AT`, `DE`, `CH`, `RO`) — no tables, no columns, because a new enum value can't be referenced in the migration that creates it. Apply with `prisma migrate deploy` and verify against the live DB.

**B1b**
> Add `Site.country CountryCode NOT NULL`. Backfill explicitly in the migration SQL — `RO` for the dev fixture company's sites, `AT` for the demo company's — never relying on a column default, same discipline as the `AssessmentSession.mode` migration. Do not add a country to `Company`. Re-verify against the live DB afterwards and confirm no site was left on a default.

**B1c**
> Restructure `(marketing)` to `(marketing)/[country]` for `at`/`de`/`ch` with `generateStaticParams` and `notFound()` on anything else; `/` becomes a country chooser page with `hreflang` alternates, not a redirect. Add `src/lib/country/` with a country-pack resolver layered over the existing locale dictionaries — do not add a fourth locale. Populate AT terminology; stub DE and CH. Visiting a country route sets the locale cookie only when none exists. Read the plan's §4.1–§4.2 before starting; the terminology list there is not optional flavour.

**B2**
> Add `PostureSampleSource` (enum-only migration first), then `PostureSample.source NOT NULL` backfilled to `CAMERA_MEDIAPIPE`, `keypoints` made nullable, and a hand-added CHECK enforcing keypoint shape by source — copy `ManualInput_value_shape_check` as the pattern and re-verify it rejects at DB level, not just in the app. Then build manual angle entry on the task page writing `BodyRegionScore` rows directly, and give `buildRegionResults()` an explicit manual branch that reads persisted scores rather than recomputing from keypoints. Do not change the `PostureSampleResponse` shape. Every PDF gains a source column.

Continue one milestone per prompt. For **B4**, explicitly instruct the hand-added partial unique index on `ExposureLimitCatalogVersion.isActive`, pointing CC at `MethodologyVersion_isActive_unique_when_true`, and state plainly that no limit value may be seeded without a human-verified RIS reference in the migration comment.

---

## 11. What not to let drift

- **No cross-country limit fallback. Ever.** If AT has no seeded value for a parameter, the UI says so. Showing a German number to an Austrian customer is not a rounding error; it's the kind of thing that ends a pilot.
- **Country is not language.** The moment someone adds a `de-AT` locale, the dictionary matrix doubles and the country pack rots. Terminology overrides go in the country pack.
- **Parallel sub-scores, one methodology version.** Not a blended composite, not per-factor versioning.
- **Psychosocial stays aggregate.** No per-respondent table, ever, in any schema revision, for any customer request. The 15-person floor is a DB CHECK, not a UI hint.
- **Manual entry never masquerades as measurement.** Provenance on every sample, on every artifact, always.
- **The verification loop is the product.** Everything else is documentation with a good UI. When something must be cut, cut toward keeping `IMPLEMENTED → VERIFIED` with real evidence intact and legible.
