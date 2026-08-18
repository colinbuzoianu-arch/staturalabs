# SLD next steps — B8b through B8f

**Context for CC.** Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md`, and `SLD_IMPLEMENTATION_PLAN_austria-first.md` fully first. B0–B8 of the Austria-first plan are done. This document covers the work between B8 and the B9/B10 decision gate.

**Naming:** B8b–B8f, same B-series.

**Three decisions that change the shape of the next sessions, stated up front:**

1. **Camera capture is hidden, not just demoted.** The capture tab, the `<video>` element, MediaPipe initialisation, the skeleton rendering — all of it is removed from the user-facing UI. The API route (`POST /api/posture-samples`) stays intact (it's a tested, field-validated path and deleting it creates a real regression risk for no gain), but nothing in the `(app)` dashboard links to it or renders it. The manual-entry tab becomes the only entry path. This is cheaper than maintaining a "demoted but visible" camera path that confuses a demo and invites questions about visual fidelity — questions the frozen skeleton work can't answer.

2. **Ankle is dropped from the scored region set.** `ANKLE_LEFT`/`ANKLE_RIGHT` have no `ScoringRule` rows, no camera formula that could produce them reliably (far-side occlusion), and no ergonomic assessment methodology that evaluates ankle flexion independently of knee and standing posture. In a manual-entry-only world they are two extra form fields with no scoring output. Remove them from `COMPUTED_BODY_REGIONS` — they stay in the `BodyRegion` enum (removing enum values from Postgres is destructive and unnecessary) but are inert, same as `HIP`/`UPPER_ARM_*`/`FOREARM_*` already are.

3. **Full German on the AT path — everything, not just the SGD.** Austrian SFKs and Arbeitsinspektoren work in German. Every string a user sees when `Site.country === AT` should be German: the dashboard, administration, reports, enum labels, region names, status values. The existing i18n scope boundary ("raw enum values stay untranslated because they mirror the DB") made sense when the product was a dev tool. For a customer-facing Austrian product it reads as unfinished. Translate them.

---

## B8b — camera UI removal + ankle trim

**Camera UI removal.** On `(app)/tasks/[taskId]/capture/page.tsx`:

- Remove the `EntryMode` tab switcher. The page becomes manual-entry only — no "Camera" / "Manual entry" tabs, just the `ManualAngleEntryPanel` as the page's sole content (below the existing `ManualInputPanel` for load/force/repetition/duration, which stays exactly as it is).
- Remove all `getUserMedia`, MediaPipe, `<video>`, `<canvas>`, skeleton overlay, multi-person picker, GPU/CPU delegate logic. The `import` of `mediapipe-client.ts`, `draw-skeleton.ts` and every `CAMERA_MEDIAPIPE`-specific branch in this page go away.
- Do **not** delete `src/lib/pose/mediapipe-client.ts`, `src/lib/pose/angles.ts`, `draw-skeleton.ts`, or `POST /api/posture-samples`. They stay in the repo as working, tested code. Just no UI reaches them. If the files are only imported by the removed page code and by tests, that's fine — the tests keep running.
- `PostureSampleSwitcher` no longer needs to handle `CAMERA_MEDIAPIPE` display (no skeleton, no validate/reopen controls). Simplify to always show the `ManualRegionTable`. Keep the `source` badge so historical camera samples still display correctly in read views.

**Ankle trim.** Remove `ANKLE_LEFT`/`ANKLE_RIGHT` from `COMPUTED_BODY_REGIONS` in `src/lib/pose/angles.ts`. `ManualAngleEntryPanel` will stop showing ankle inputs. `buildRegionResults()` will return `not-yet-supported` for ankle on both camera and manual samples — same as `HIP`/`UPPER_ARM_*`/`FOREARM_*` already do. No migration, no enum change, no scoring-rule change (there are no ankle rules to remove).

Result: **6 scored regions** in manual entry — TRUNK, NECK, SHOULDER_LEFT, SHOULDER_RIGHT, ELBOW_LEFT, ELBOW_RIGHT — plus KNEE_LEFT, KNEE_RIGHT staying as the 8th computed set (knee has scoring rules and is ergonomically meaningful for standing/kneeling tasks). So: **8 regions with scoring rules**, minus ANKLE = **6 angle inputs on the form** (TRUNK, NECK, SHOULDER ×2, ELBOW ×2) plus KNEE ×2 = **8 angle inputs total**.

Wait — KNEE stays. It has scoring rules (0–10° LOW, 10–60° MODERATE, 60°+ HIGH). It matters for standing, kneeling, and ladder work. Only ANKLE goes.

**Update CLAUDE.md:** remove the "camera is demoted" language from "Frozen and demoted work" and replace with "camera UI is removed from the dashboard; the API route and supporting libs stay in the repo as tested code, reachable if the B10 decision reinstates a capture path." Note ankle removal.

**Verification bar.** The capture page renders with manual entry only, no `<video>` element in the DOM. Historical camera samples still display correctly on the task page (read view). The ankle fields are gone from the form. `npm test` green (camera-path unit tests still pass even though no UI reaches them). Camera API route still returns `201` on a valid POST (regression check — not reachable from the UI, but the route must not break).

---

## B8c — full German for AT

This is the big translation pass. The goal: when `statura-locale` cookie is `de` (which the `/at` middleware sets by default), every visible string in the authenticated dashboard and administration surface is German. No English leaks through.

**What changes:**

### 1. BodyRegion labels — translate them

The existing scope boundary said "raw enum values stay untranslated." Override it explicitly. Add `bodyRegionLabels` to `dashboard/de.ts` and `administration/de.ts`:

```
TRUNK: "Rumpf",
NECK: "Nacken",
SHOULDER_LEFT: "Schulter links",
SHOULDER_RIGHT: "Schulter rechts",
ELBOW_LEFT: "Ellbogen links",
ELBOW_RIGHT: "Ellbogen rechts",
KNEE_LEFT: "Knie links",
KNEE_RIGHT: "Knie rechts",
```

English (`en.ts`) gets the same keys with the English names. Every place that currently renders `BodyRegion` raw — the task page's per-region table, the manual entry form labels, the workstation risk page's concerning-region summary, `describeRegionResult()` — resolves through these labels instead.

### 2. RegionResult status strings — translate them

Currently `scored`, `wrong-camera-angle`, `insufficient-visibility`, `no-matching-rule`, `not-yet-supported` render as raw English strings. Add `regionResultStatusLabels` to both dictionaries:

```
scored: "Bewertet",
"wrong-camera-angle": "Falscher Kamerawinkel",
"insufficient-visibility": "Unzureichende Sichtbarkeit",
"no-matching-rule": "Keine passende Regel",
"not-yet-supported": "Noch nicht unterstützt",
```

With camera UI removed, `wrong-camera-angle` and `insufficient-visibility` only appear on historical camera samples. But they still need German labels when displayed.

### 3. CameraAngle — translate for display

Only appears on historical camera samples' read view now:
```
SAGITTAL: "Seitenansicht",
FRONTAL: "Frontalansicht",
```

### 4. RiskBand — translate for display

This was the strongest holdout. Translate it:
```
LOW: "Gering",
MODERATE: "Mäßig",
ELEVATED: "Erhöht",
HIGH: "Hoch",
```

The internal DB value stays the English enum. The UI shows the German label. Same thing `HazardCategory` and `ActionStatus` already do — they're translated in the dictionaries, the DB holds the enum. `RiskBand` was the only one that didn't follow this pattern.

### 5. `describeRegionResult()` and `describeManualInput()` — make locale-aware

These functions currently return hardcoded English strings. They need a `locale` parameter and return the German equivalent when `de`. This is the most invasive part of this milestone — every call site passes `locale` through.

### 6. Reports — German versions

All three non-SGD reports (task report, risk-assessment report, worker briefing) gain German output. Same approach as the SGD: not locale-driven, but country-driven. `Site.country === AT` → German. `Site.country === RO` → English (or Romanian, but English is the safe default for now). Add `lang` query param to each route, defaulting based on country.

**The worker briefing's compliance-sensitive text needs your review.** CC produces a draft translation in the same register as the SGD's German text. You approve it before it ships. Same discipline as `/at/legal`.

### 7. Marketing `/at` — complete German

Check whether any string on `/at`, `/at/about`, `/at/legal` still renders in English when the locale cookie is `de`. If the country pack's `positioningLine.de` and the marketing dictionary's `de.ts` cover everything, this might already be done. Verify, don't assume.

### 8. Country-pack terminology in the dashboard

Where the dashboard currently says "Risk assessment" or "Evaluation," the AT path should say "Evaluierung." Where it says "Download SGD," it should already say "Sicherheits- und Gesundheitsschutzdokument" — but check. The country pack has the terminology; the dashboard may not be consuming it everywhere yet.

**Verification bar.** Sign in to the AT demo account with locale `de`. Walk every page in the authenticated dashboard and administration. No English string visible except the raw `cuid` IDs in URLs and the `@statura.local` email addresses. Every report generated for an AT site is in German. The `/at` marketing page has no English when locale is `de`.

---

## B8d — repetition scoring

**The problem.** `REPETITION_COUNT` is captured, displayed, and read by nothing. With posture + hold time + load all scored, a high-rep low-load task shows three green sub-scores. The SGD asserts completeness around a false negative.

**What to build.** `RepetitionRule` model, same `[min, max)` shape as `ManualHandlingRule`. ISO 11228-3 / EN 1005-5 as the reference. Same arm's-length framing. Fold into `v2-2026-08`, no version bump. `deriveAppliedStandards()` gains a fifth entry. Task page and PDF show the sub-score. German labels for AT.

**Scope.** `REPETITION_COUNT` is reps per task cycle, scored as a raw count. No frequency calculation introduced.

---

## B8e — WRIST as manual-only regions

**The problem.** `WRIST` has no `BodyRegion` values or scoring rules. Manual entry makes this solvable without any CV work.

**What to build.**

- `WRIST_LEFT`/`WRIST_RIGHT` already exist in the `BodyRegion` enum (no migration needed).
- Add `ScoringRule` rows under `v2-2026-08` for wrist flexion/extension angle ranges.
- Add wrist to `COMPUTED_BODY_REGIONS` (but only for `MANUAL_ENTRY` — `computeBodyAngles` still returns `not-yet-supported` for wrist since there's no camera formula).
- `ManualAngleEntryPanel` gains two wrist inputs.
- German labels: `Handgelenk links` / `Handgelenk rechts`.
- Update CLAUDE.md known-limitations: wrist is now scored via manual entry.
- Update marketing copy: wrist/hand capture → wrist scored via manual entry, camera-based wrist remains unbuilt.

---

## B8f — demo fixture update

**The problem.** B7 built psychosocial but the demo fixture doesn't show it. B8d adds repetition scoring, also invisible in the demo. A demo that hides features is wasted work.

**What to build.** Update `seed-demo-fixture.mjs`:

- `PsychosocialFindingDetail` on the existing `PSYCHOSOCIAL` finding (dimension: `WORK_ORGANIZATION`, method: `GROUP_DISCUSSION`, groupSize: 8 — below 15, showing the small-group path).
- `REPETITION_COUNT` `ManualInput` on the hero workstation's task (e.g. 450 reps).
- Update `reset-demo-fixture.mjs`'s delete sequence for `PsychosocialFindingDetail`.
- Verify idempotency: `reset:demo && seed:demo` twice, row counts stable.

---

## Session sequence for CC

| Session | Prompt | Gate |
|---|---|---|
| 1 | **B8b** — remove camera UI, trim ankle | Capture page is manual-only, no `<video>` in DOM, ankle gone from form, camera API route still 201 |
| 2 | **B8c** — full German for AT | Every visible string is German when locale=de on an AT site. **You** review worker briefing translation |
| 3 | **B8d** — repetition scoring | 450-rep input bands correctly, `deriveAppliedStandards` includes ISO 11228-3 |
| 4 | **B8e** — wrist manual regions | Wrist inputs on form, wrist scores for manual, stays `not-yet-supported` for camera |
| 5 | **B8f** — demo fixture | `reset:demo && seed:demo` twice stable, psychosocial detail and repetition visible |

After B8f the product is feature-complete for an Austrian demo with every mandated evaluation dimension scored, every string in German, no camera UI in the way, and a demo that shows everything built. B9/B10 is your call.

---

## What is deliberately NOT in this list

- **Deleting camera code from the repo.** The API route, `mediapipe-client.ts`, `angles.ts`, `draw-skeleton.ts`, and their tests stay. Removing them creates a real regression risk if B10 reinstates camera capture. Hiding them from the UI is sufficient.
- **Push/pull force scoring (ISO 11228-2).** Needs verified reference numbers from a paid standard. Add as B8g when you have the source.
- **Hold-time in aggregate bands.** B3 scoped this out explicitly. Still a separate design decision.
- **Job rotation / cycle time.** Still the right thing to model eventually, still a schema expansion, still deferred.
- **Skeleton / 3D improvements.** Frozen per §9. Unfreeze conditions unchanged.
