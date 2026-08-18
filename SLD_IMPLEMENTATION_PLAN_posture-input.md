# SLD implementation plan — posture input decision (B10 resolved)

**Context for CC.** Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md`, and `SLD_IMPLEMENTATION_PLAN_austria-first.md` first. B0–B8f are done; camera UI is removed from the dashboard; manual angle entry is the sole input path. This document records the B10 decision and the work that follows from it.

---

## 1. The decision, and why

Three options were on the table for how posture gets into the system:

**(a) 3D model driven by camera capture, manually adjustable.** Rejected. This is the frozen fidelity work plus a new dependency chain (licensed rigged avatar, retargeting from MediaPipe keypoints to a rig, WebGL on the low-end machines EHS staff use). It reintroduces the camera path that was just removed, reopens the exact visual-quality problem that burned weeks of momentum, and the adjustment UI it requires *is* the frozen editor. Every cost that froze §9 applies, plus retargeting. Nothing has changed to unfreeze it.

**(b) Precise degree entry per region.** What B2 built. Rejected as the primary input — not because it's wrong, but because it's false precision. Nobody on a factory floor measures 47° with a goniometer; an assessor estimates. Asking for a number the assessor doesn't have makes the tool feel like it demands data nobody collects, which is exactly the friction that kills field adoption.

**(c) Posture category rating per region.** Chosen. The assessor classifies what they see — "Rumpf aufrecht / gebeugt / stark gebeugt" — the way every field-usable observational method works, and the way the Austrian guidance materials themselves present posture risk.

**The key fact that makes (c) nearly free:** the scoring engine is *already* categorical. `ScoringRule` rows are `[min, max)` degree ranges — TRUNK's three rules (0–20 / 20–60 / 60+) *are* "upright / bent / strongly bent." The degree input was a precision layer the engine never needed. Replacing the number field with a category picker whose options are **generated from the active methodology's own `ScoringRule` rows** changes the input UI and nothing else: scoring, `MethodologyVersion`, hold time, the SGD, band trends, verification — all untouched, because they consume the rule match, not the raw degrees.

This also makes the input **self-versioning**: if a future methodology version changes TRUNK's thresholds, the picker's categories change with it automatically, because they're read from the same rows. No second source of truth.

**§3.7 check (EAWS/LMM clone concern):** categories derived from SLD's own already-seeded rule ranges, inspired by ISO 11226 / EN 1005-4 posture classes, are the same arm's-length relationship every other scoring axis already has. Do not copy LMM's pictograms, wording, or point values. Category labels are written fresh from the rule ranges.

---

## 2. What the workplace evaluation looks like after this

Per task, the assessor records:

| Input | Mechanism | Standard anchor |
|---|---|---|
| Posture, per region | Category pick (from rule ranges) | ISO 11226 / EN 1005-4 posture classes |
| Hold duration | Seconds (existing, optional) | ISO 11226 hold-time ceilings |
| Load weight | kg (existing `ManualInput`) | ISO 11228-1 / EN 1005-2 |
| Repetition | Count (existing, scored in B8d) | ISO 11228-3 / EN 1005-5 |
| Push/pull force | Recorded, unscored (existing) | ISO 11228-2, pending verified thresholds |
| Exposure measurements | Instrument values vs. AT catalog | VOLV etc. (B4) |
| Psychosocial | Structured findings (B7) | ÖNORM EN ISO 10075 |

That is a complete, defensible workplace evaluation with **zero angle measurement anywhere** — parallel traceable sub-scores, worst-of rollup, every number citing a named public standard, exactly the §6 architecture. The posture sub-score's evidence claim honestly becomes "assessor's observational classification," which is *stronger* in front of a Betriebsrat than a pseudo-precise degree number nobody can reproduce.

---

## 3. B11 — category-based posture entry

### 3.1 Category derivation (pure, tested)

New `src/lib/scoring/posture-categories.ts`:

- `derivePostureCategories(rules: ScoringRule[], region: BodyRegion): PostureCategory[]` — pure. Groups the active methodology's rules for one region, sorts by range, returns one category per rule: `{ ruleRange: [min, max), band, riskScore, representativeDegrees }`.
- `representativeDegrees` = the range midpoint; for open-ended ranges (`max: NULL`), `min + 15`. This is what gets persisted (see 3.2) and what hold-time and every downstream consumer sees. It is a **category marker, never presented as a measurement**.
- NECK needs care: its rule set spans negative (backward extension) and positive (forward flexion) ranges with different scores. The picker for NECK gets both groups, labeled — "Rückneigung" options and "Vorneigung" options in one select. The derivation function must handle sign correctly; unit-test NECK explicitly against the seeded v2 rows.
- Handle SHOULDER's 4 tiers (LOW/MODERATE/ELEVATED/HIGH) — category count per region comes from the data, never hardcoded.

### 3.2 Persistence — no schema migration needed

- `PostureSampleSource` gains **no new value**. `MANUAL_ENTRY` already means "assessor-entered"; the precision of entry is recorded per sample instead:
- `manualAngles` (existing `Json?`) stores the `representativeDegrees` per region **plus** a new sibling key `entryMode: "category" | "degrees"` inside the same JSON object. No column change — the JSON shape gains a discriminator. `validateManualAngles` extended accordingly, with the existing degree shape remaining valid (historical rows).
- `BodyRegionScore` rows written exactly as today, from the picked category's own rule (no re-matching needed — the category *is* the rule).
- Every artifact that prints a manual sample's angle now checks `entryMode`: `"category"` renders the category label ("Rumpf: gebeugt (20–60°)"), never a bare degree number. §3.16 provenance discipline: a classification must not masquerade as a measurement.

### 3.3 UI

`ManualAngleEntryPanel` becomes `PostureCategoryPanel`:

- One labeled select (or button group) per computed region, options from `derivePostureCategories` against the rules the panel already fetches from `GET /api/scoring-rules` (zero new endpoints).
- Option label pattern: `{category name} ({min}–{max}°) — {band}`, German-first per B8c: "Aufrecht (0–20°) — Gering". Category names per region live in the i18n dictionaries (dashboard area, `de`/`en`/`ro`), keyed by region + rule index — hand-authored presentation copy, same class as `manualInputLabels`.
- Live band feedback stays (it's now trivial — the pick *is* the band).
- An "Expertenmodus: Gradeingabe" toggle keeps the existing degree inputs reachable for assessors who did measure (goniometer app, inclinometer). Default is category mode. Both write through the same `POST /api/posture-samples/manual` with the `entryMode` discriminator.
- A neutral "nicht beurteilt" option per region — an unassessed region is legitimate (assessor couldn't observe it) and must be recordable as absent, not forced to a guess. Persisted as the region simply missing from `manualAngles`; `buildRegionResults` reports it as a new explicit status `not-assessed` (additive to the `RegionResult` union, never silently dropped — same philosophy as `no-matching-rule`).

**Note:** `validateManualAngles` currently requires *every* computed region. That requirement is removed — partial entry becomes valid for both modes. At least one region must be present (a sample with zero regions is a 400).

### 3.4 Reports and SGD

- Task report / SGD render category-mode samples as classifications: "Rumpf: gebeugt (20–60°) — MODERATE", plus one line stating the method: "Beurteilung durch Einstufung der beobachteten Körperhaltung (ISO 11226 / EN 1005-4 orientiert), nicht durch Winkelmessung." Honest, and reads as methodology, not as a caveat.
- `deriveAppliedStandards()` unchanged — same standards apply; the input precision changed, not the methodology.

### 3.5 Verification bar

- Unit tests: `derivePostureCategories` against seeded v2 rows for TRUNK (3), SHOULDER (4), NECK (both signs), KNEE. Category count and boundaries must match the rules exactly.
- DB CHECK regression: existing `PostureSample_source_shape_check` still passes for both entry modes.
- HTTP walkthrough: category-mode sample → `201`, correct bands, task page renders category labels not degrees, PDF (parse with `pdfjs-dist`, temporary) shows the classification line and the method sentence. Degree-mode (expert toggle) still works. Historical degree-mode rows still render.
- German end-to-end on the AT path per B8c's bar.

---

## 4. What this closes and what stays open

**Closed by this decision:**
- B10 (camera revisited) — resolved as: no camera path, no 3D model. The API route and pose libs stay in the repo as dormant tested code; nothing more.
- B9 (reach envelope) — moot in its CV form. Reach, if ever wanted, becomes another category question ("Greifweite: nah / weit / über Schulter"), a future rule-driven axis like everything else.
- The §9 freeze — no longer needs an unfreeze path for product reasons. `SLD_POSTURE_EDITOR_FIDELITY_PLAN.md` stays frozen indefinitely; update its header from "frozen, see §9" to "closed — superseded by category-based entry, see this plan."

**Update CLAUDE.md** (B11's session must do this): Project description's input-path sentence; "Frozen and demoted work" → camera UI removed and posture editor closed, category entry is the input model; known-limitations entries about camera geometry move under a "dormant camera path" note.

**Stays open, unchanged:**
- Push/pull thresholds (needs the paid ISO 11228-2 source — B8g when available).
- Job rotation / cycle time as workstation attributes.
- Hold-time in aggregate band colors.

---

## 5. CC prompt (one session)

> Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md`, `SLD_IMPLEMENTATION_PLAN_austria-first.md`, and `SLD_IMPLEMENTATION_PLAN_posture-input.md` fully. Build B11 per §3 of the posture-input plan: pure `derivePostureCategories` first with unit tests against the seeded v2 rules (NECK's negative ranges and SHOULDER's 4 tiers are the cases that will silently break — test them explicitly), then the `entryMode` discriminator in `manualAngles` with `validateManualAngles` accepting partial entry, then the category picker UI with the expert degree toggle and the "nicht beurteilt" option, then the report/SGD rendering per §3.4. No schema migration. No new endpoints. German labels per the B8c standard. Finish with the full verification bar in §3.5 and the CLAUDE.md updates in §4. Do not touch the dormant camera/pose libs or the frozen posture editor plan except its header.
