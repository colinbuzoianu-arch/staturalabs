# SLD P16 — Prepared chemistry engines in the app (sandbox-ready, flag-gated): founder-approved

**Approved by:** Colin Buzoianu (founder), 2026-11-14 (revised the same day). Follows P15. The six prepared engines (CLP mixture classification, physical estimates, WGK mixture calculation, Lagerklasse suggestion, transport/UN lookup, SDS authoring) work in scripts but no page uses them. Goal: make them **usable in the running app**, so they can be shown to prospects in the **founder's prospecting sandbox**, while unreviewed chemistry never becomes part of a real customer's authoritative data. Same engineering rules as always (registry, shell + primitives, versioned data, hand-written migrations, enum-first, RLS + non-owner role, `Restrict` FKs, append-only history, `AuditEvent`, DE/EN/RO, tests green per commit, slices with commit + push).

Carried over from P15: no US content, no in-page AI agent, no chemistry expert available, so CC makes conservative defaults and **doesn't ask chemistry questions**.

**Sandbox:** the whole platform will later run as a prospecting sandbox at `staturalabs.com/sandbox`. **It is not built in P16.** Everything here follows `SLD_SANDBOX_READINESS_RULES.md` (base-path safe, config-driven URLs and defaults, seeds as code), so the sandbox milestone can reuse it without rework. Until then, the founder demos in a dedicated demo tenant in production.

---

## 1. Core idea: compare, don't replace

Every engine result appears **next to** what the supplier's SDS declares:

| | SDB (Lieferant) | Berechnung (Vorschau) | Status |
|---|---|---|---|
| e.g. Einstufung | H225, H319 | H225, H319, H336 | ⚠ Abweichung prüfen |

This is the strongest prospect demo: SLD checks whether a supplier's data sheet adds up. Engine output never overwrites register fields.

## 2. Three-state engine flags

Extend the P13 flag store so each engine flag per tenant has three states, set only by `super_admin` in `/admin/flags`:

| State | What the tenant sees |
|---|---|
| `OFF` | Nothing. |
| `PREVIEW` | Engine output in the comparison views, read-only, with a fixed banner: **"Vorschau-Berechnung — nicht fachlich geprüft. Nicht für Kennzeichnung, SDB oder Weitergabe verwenden."** Generated PDFs carry the watermark **"ENTWURF — NICHT ZUR WEITERGABE"**. No "übernehmen" button. |
| `VALIDATED` | For after an expert review: allows adopting a result into the register (human-confirmed, provenance `engine-validated`). **Can't be set** unless an `EngineReview` record exists for that engine version (reviewer, qualification, date, scope, notes). Build the record and guard now; nobody sets it yet. |

- Every state change writes an `AuditEvent`.
- Every result stores the engine version and the input data versions it used.

**Defaults come from one resolver keyed on `APP_ENVIRONMENT`** (sandbox readiness rule 4):
- **`production` (built now):** new tenants get all engines `OFF`. The demo tenant is set to `PREVIEW` by the seed (§5). The founder can switch a pilot tenant to `PREVIEW`; the banner stays.
- **`sandbox` (resolver branch prepared, not used yet):** new tenants will default to `PREVIEW`. The sandbox milestone switches it on.
- `VALIDATED` behaves the same in every environment (guarded by the review record).

## 3. The missing inputs

### 3.1 Mixture composition
- **`MixtureComponent`** on `Substance`: reference substance (CAS → `ReferenceSubstance`), concentration as exact value **or** range (min/max %), plus per component where known: classification (Annex VI or SDS), specific concentration limits, M-factor, ATE values, WGK.
- **Filled automatically from the confirmed SDS section 3** (P15 S2 extracts components), so supplier products need no new typing.
- **Composition editor** for own mixtures or to correct an extraction. Validation: exact concentrations sum ≤ 100 %, plausible ranges, CAS checksum, duplicate components flagged.
- **Ranges:** engines use the conservative end of each range and state which one. Documented in `CHEMISTRY_ENGINE_NOTES.md`.

### 3.2 Data readiness per product
A "Datenbasis" panel per product lists which inputs each engine has and which are missing. With missing inputs, the engine **refuses and says why**; it never guesses.

### 3.3 Reference data
- Annex VI, H/P/EUH catalogue, WGK list, reference properties: from P15. The super-admin catalogue page shows which engine depends on which catalogue version.
- **Transport list:**
  - CC checks whether an official machine-readable ADR dangerous goods list (Table A) exists under open reuse terms. If yes, import it per P15 `official-import` (ADR only; IMDG/IATA stay excluded).
  - If not, keep a **small curated list** marked `DEMO_LIST`, checked against the published ADR text. It's available in both environments, and outside it the app shows "Gefahrgutliste nicht geladen".
  - Record the outcome in `DATA_SOURCES_AND_LICENSES.md`.

## 4. Where each engine appears

On the product detail page, a new tab **"Prüfung & Berechnung"**, visible when at least one engine is `PREVIEW` or higher.

| Engine | Comparison | Also used in |
|---|---|---|
| CLP mixture classification | Proposed hazard classes, H/EUH, pictograms, signal word vs. SDS section 2; each statement expandable to its calculation (components, rule, threshold). Physical hazards: "nicht berechenbar — Prüfdaten erforderlich". | Consistency hints (P15 S3), as a hint. |
| Physical estimates | Density, boiling-range lower bound, flash-point estimate vs. SDS section 9, labelled *Näherungswert*. | Hint if the SDS flash point and the estimate disagree. |
| WGK mixture (DE sites) | Calculated WGK vs. SDS section 15, with rule steps. | — |
| Lagerklasse suggestion (DE sites) | Suggested class with decision path vs. stored class. | TRGS 510 check shows a hint on mismatch; the check keeps using the stored class. |
| Transport | Suggested UN entry, class, packing group vs. SDS section 14, only for entries in the loaded list. | — |
| SDS authoring | **"SDB-Entwurf erzeugen"**: 16-section draft PDF with watermark, archived as `GeneratedDocument` type `SDS_DRAFT_PREVIEW`. No other export format. | — |

- **Site overview:** a list "Abweichungen SDB ↔ Berechnung" per site.
- **Internal sandbox for the founder:** under `/admin`, paste a composition and see all six outputs. Super-admin only.

## 5. Demo seed pack (reusable later for the sandbox)

A code-defined dataset that **provisions any tenant** in one command or one `/admin` button: `seed:prospect`, idempotent, tenant-scoped. Used now for the demo tenant in production, and reused unchanged by the later sandbox (readiness rule 5).
- **6–8 products with fictional product and supplier names** (no real brands, no imitation of real suppliers' data sheets), built from **real substances** (e.g. acetone, ethanol, xylene isomers, a sensitiser, a low-concentration CMR component) with real CAS numbers and Annex VI data.
- A full 16-section SDS for each, footer "Demo-Datenblatt".
- **Mostly agreeing results plus 2–3 deliberate supplier errors:**
  - flash point vs. H statement mismatch;
  - a sensitiser above its limit without its H statement;
  - a WGK declared too low.
- AT and DE demo sites, storage locations with one forbidden TRGS 510 combination, and one approved Betriebsanweisung.
- **`reset:prospect`** restores a tenant to the clean seed state, using the same leaf-to-root deletion discipline as `reset:demo`. It refuses to run on a tenant that isn't marked as a prospect/demo tenant.

**Not built now (deferred to the sandbox milestone):** prospect-tenant lifecycle (`tenantKind = PROSPECT`, expiry, deletion), the permanent "Demo-Umgebung" band, sandbox AI caps. Keep the seed pack and reset free of anything that would block them.

## 6. Prospect demo script

`DEMO_SCRIPT_GEFAHRSTOFFE.md` (German), about 10 minutes, following the real UI on a seeded prospect tenant:
1. Upload a demo SDS (or the prospect's own) → AI extraction → confirm fields.
2. Product in the register; Betriebsanweisung draft.
3. "Prüfung & Berechnung": classification comparison with one deviation explained step by step.
4. Site deviation list.
5. TRGS 510 storage check with the forbidden combination.
6. Watermarked SDS draft for an own mixture.

Framing for prospects (the banner shows it on every screen): *"Berechnungslogik als Prüfhilfe; fachliche Validierung in Vorbereitung."*

## 7. Path to real customer use (prepared, used later)
- `EngineReview` + `VALIDATED` guard (§2).
- `CHEMISTRY_ENGINE_NOTES.md` as the expert review package, with per-engine test cases and open interpretation points.
- Terms-of-use template clause (P13 legal pack): preview calculations are checking aids, not classifications or legal advice. Marked `TEMPLATE — needs legal review`.
- Until an engine is `VALIDATED`, nothing it computes can reach a label, an externally sent SDS, the Gefahrstoffverzeichnis or a Betriebsanweisung, in either environment.

## 8. Build order (slices, commit + push after each, tests green)
0. Add `SLD_SANDBOX_READINESS_RULES.md` to CLAUDE.md as a standing rule; audit existing links, redirects, middleware, cookies and absolute URLs against it and fix violations; add the `/sandbox` base-path build check.
1. Three-state flags, `EngineReview` + guard, `APP_ENVIRONMENT` defaults resolver (§2).
2. `MixtureComponent`, auto-fill from SDS section 3, composition editor, data-readiness panel (§3.1–3.2).
3. Transport list investigation, then import or curated `DEMO_LIST` (§3.3).
4. "Prüfung & Berechnung" tab: CLP first, then physical estimates, WGK, Lagerklasse, transport (§4).
5. Watermarked SDS draft + archive (§4).
6. Site deviation list + `/admin` engine sandbox (§4).
7. Demo seed pack, `seed:prospect` / `reset:prospect`, applied to the production demo tenant (§5).
8. `DEMO_SCRIPT_GEFAHRSTOFFE.md`, test-case lists in `CHEMISTRY_ENGINE_NOTES.md`, terms template clause (§6–7).
9. **Verify:**
   - On the production demo tenant: walk the demo script end to end in German, check the banner and watermark, reset it.
   - Confirm other tenants see no engine output, and that `VALIDATED` can't be set without a review record.
   - The `/sandbox` base-path build check passes.
   - Update CLAUDE.md status.
