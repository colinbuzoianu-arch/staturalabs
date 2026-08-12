# SLD posture editor — fidelity plan

**Status:** Build brief. Read `ERGO_COMPLIANCE_BY_DESIGN.md` and `CLAUDE.md` first, as always.
**Scope:** The 3D posture editor only — `src/components/skeleton-3d.tsx`, `src/components/posture-editor.tsx`, `src/components/skeleton-viewer.tsx`, and the `src/lib/pose/**` modules they consume.
**Not in scope:** `computeBodyAngles`, `ScoringRule`, `MethodologyVersion`, the capture pipeline, or anything that changes a persisted score. If a change in here would alter what a `BodyRegionScore` row contains, stop — it's out of scope by definition.

---

## 0. Why this exists

The editor currently tries to be two products at once: a **correction instrument** (fix what MediaPipe got wrong, write `validatedKeypoints`) and a **communication artifact** (a picture an EHS manager or a works council understands). Those have opposite requirements — correction wants few degrees of freedom and numeric precision, communication wants a readable human figure.

The result is a stick figure with 33 rendered points, ~13 drag handles, proportions inherited from a noisy monocular estimate, and joints that appear not to "stick" when dropped. This plan resolves the conflict by **cutting the drag surface down to what is actually measurable, and rendering everything else as rigid, non-interactive geometry on standard anthropometric proportions.**

Net effect: less code than there is today, not more.

---

## 1. Diagnosis — read this before "fixing" anything

Two distinct behaviours are being reported as one bug. **Neither is a defect. Do not tune them away.**

**(a) Handles that revert completely.** `bodyRegionForJoint` (`src/lib/pose/drag-to-angle.ts`) returns `undefined` for any landmark absent from `JOINT_REGIONS`. Eyes, ears, mouth, pinky/index/thumb, heel/foot-index are rendered as spheres but have no region, so a drag on them resolves to nothing and the next render restores them. The fix is to **stop rendering them as grabbable-looking spheres**, not to make them draggable.

**(b) Handles that move partway, then stop.** `clampToLimits` (same file) clamps against `ANATOMICAL_LIMITS` in `src/lib/pose/skeleton.ts` — trunk 0–90°, neck −20–60°, elbow 0–145°, knee 0–130°, shoulder 0–180°. Dragging past a bound springs back to the bound. This is correct and must stay. What's missing is **feedback**: `computeAngleFromDrag` already returns a `clamped: boolean` that the UI currently discards.

Everything else in the complaint ("looks awkward", "proportions don't match", "feels not real") traces to proportions and rendering, addressed in P2/P3.

---

## 2. Invariants — do not let these drift

1. **The angle is the only interchange format.** The manikin introduced in P2 is a *display* geometry. A drag on it resolves to an angle; that angle is applied to the real stored keypoints via `applyAngleAdjustments` (`src/lib/pose/forward-kinematics.ts`); the real keypoints remain the substrate that gets persisted. Joint angles are independent of segment length, which is exactly why this is sound.

2. **`validatedKeypoints` must never contain manikin coordinates.** They are the human-reviewed version of a real measurement (see the `PostureSample` doc comment in `prisma/schema.prisma`). Writing synthetic standard-proportion geometry into that column silently destroys the measurement it exists to preserve. This is the single highest-risk failure mode in this whole plan — if in doubt, add an assertion rather than a comment.

3. **The live capture overlay keeps real proportions.** `completeMissingLandmarks` and the capture-time skeleton draw over an actual camera frame and must continue to match the person in it. The manikin is editor-only. Do not "unify" the two renderers.

4. **Nothing here touches the scoring pipeline.** `skeleton.ts` already carries this note at the top of the file; it applies to every module this plan modifies.

5. **Manipulable ⟺ has an `ANATOMICAL_LIMITS` entry.** After P1 this is a hard invariant, not a coincidence — it keeps the drag surface from drifting out of sync with what is scoreable. Add a unit test asserting the two key sets are equal.

---

## 3. Definition of done

- Exactly eight drag handles: `TRUNK`, `NECK`, `SHOULDER_LEFT/RIGHT`, `ELBOW_LEFT/RIGHT`, `KNEE_LEFT/RIGHT`.
- No handle in the editor can be grabbed and released without something changing, or without a visible reason why it didn't.
- Head, hands and feet are rigid, non-interactive, always in neutral; feet at 90° to the shank.
- The figure reads as a human body at a glance, on standard proportions, and is obviously a synthetic mannequin rather than a portrait of anyone.
- Limbs the camera could not see well are visibly distinguished from limbs it measured confidently.
- `npm test`, `tsc --noEmit`, `biome check` all clean; removed behaviour has its tests deleted deliberately, not left orphaned.

---

## P1 — Cut the drag surface

**Files:** `src/lib/pose/skeleton.ts`, `src/lib/pose/posture-editor.ts`, `src/components/skeleton-3d.tsx`, plus their tests.

Remove position-only dragging entirely: `POSITION_ONLY_REGIONS`, `POSITION_ONLY_CLUSTER`, `VIRTUAL_HIP_LANDMARK_INDEX`, `getVirtualHipPosition`, and the position-only branches in `posture-editor.ts` (`REGION_TO_POSITION_LANDMARK`, `POSITION_ONLY_REGION_SET`, `positionOnlyAnchor` and their call sites).

Rationale, to record in the commit message rather than lose:

- `WRIST_LEFT/RIGHT` feed no scoring rule and cannot without MediaPipe Hand Landmarker (`CLAUDE.md`, "Known limitations"). Today they are pure interaction cost.
- `ANKLE_LEFT/RIGHT` measure dorsiflexion, which a single 2D camera structurally cannot observe — `skeleton.ts` already says so.
- `HIP` is TRUNK renamed, as that same comment concedes.
- Free translation of a joint also breaks segment-length invariants visually, which is a direct contributor to the "looks awkward" report.

Replace the hip handle's practical purpose (re-framing the figure) with camera orbit/pan in `skeleton-3d.tsx`. Camera state is view-only and must never be persisted.

Delete the corresponding cases in `skeleton.test.ts`, `posture-editor.test.ts` and `drag-to-angle.test.ts` rather than leaving them skipped.

Then add the invariant test from §2.5: the key set of `JOINT_REGIONS` maps onto exactly the key set of `ANATOMICAL_LIMITS`.

**Size:** small. Mostly deletion.

---

## P2 — Standard manikin proportions

**New file:** `src/lib/pose/manikin.ts`. Pure math, no DOM, no three.js scene objects — same posture as the rest of `src/lib/pose/**`.

Fixed segment-length ratios expressed as fractions of stature, sourced from published anthropometric data (DIN 33402-2 / ISO 7250, 50th percentile). Cite the source in a header comment and treat the ratio table as data, not scattered constants.

The module's job: given the eight joint angles, produce a full set of manikin-space positions for rendering. Angles in, positions out. It never reads a `PostureSample`, never writes one, and has no notion of visibility or confidence.

Two things this deliberately achieves at once:

1. Proportions stop being inherited from a monocular stature estimate, which is where most of the "doesn't match a human body" impression comes from.
2. The rendered figure stops being subject-specific at all — a strengthening of `ERGO_COMPLIANCE_BY_DESIGN.md` §3.2, not merely compatible with it. Note this in the module header.

`completeMissingLandmarks` in `skeleton.ts` stays exactly as it is, for the capture overlay. Do not refactor them together.

**Wiring:** `skeleton-3d.tsx` renders from `manikin.ts`. Drag → angle (existing `computeAngleFromDrag`, which is proportion-independent at the joint vertex) → `applyAngleAdjustments` on the real keypoints → persisted. Add a test asserting a full drag round-trip leaves the persisted keypoints in real-landmark space, i.e. that segment lengths of the persisted result match the original sample's, not the manikin's.

**Size:** medium. This is the load-bearing phase.

---

## P3 — Solid body rendering

**File:** `src/components/skeleton-3d.tsx`.

Replace `THREE.Line` bones and `SphereGeometry` joints with capsule/cylinder limb meshes over the same bone chain. `three@^0.185` is in `package.json`, so `CapsuleGeometry` is available.

Design intent, and it is intent rather than taste: **a neutral grey mannequin, not a realistic human.** A realistic figure invites "is that the operator at station 4?", which is precisely the client-usage risk counsel flagged in §2.1 — a workstation score becoming a proxy for a named person. An obviously synthetic mannequin carries the workstation-not-worker framing visually without a disclaimer.

Rigid, non-interactive, always neutral:

- **Head** — one solid element, rigidly oriented along the neck vector. The `NECK` drag handle stays at the head, since `JOINT_REGIONS` already pivots `NECK` on `NOSE` and `applyNeckRotation` matches. Drop every other head landmark from the render.
- **Hands** — one solid element per side, neutral to the forearm. No fingers.
- **Feet** — one solid element per side, fixed at 90° to the shank. This is the anthropometric neutral convention, not an approximation, and since `ANKLE` has no scoring rule it changes no number anywhere.

Keep `BODY_REGION_BONES` as the region→segment mapping for colouring; that table is still correct.

**Size:** medium. Self-contained.

---

## P4 — Numeric-primary interaction

**File:** `src/components/posture-editor.tsx`.

Sliders and number inputs already exist per region, and `applyResolvedAngle` already accepts a resolved number — so this phase is about precedence and feedback, not new controls.

- The numeric value is the single source of truth. The drag is a coarse gesture that writes to it; the slider and number field always reflect the same state.
- Surface `clamped` from `computeAngleFromDrag`. When a drag hits an anatomical bound, say so at the joint ("limited to 90° — trunk flexion range"). Silence is what makes a clamp feel like a bug.
- Degree-accurate dragging on a 2D projection of a 3D joint is genuinely hard, and no amount of tuning changes that. Precision lives in the number field by design; the viewport is for judgement and communication.

**Size:** small.

---

## P5 — Show measurement confidence

**File:** `src/components/skeleton-3d.tsx`.

Render limbs below `MIN_LANDMARK_VISIBILITY` visibly distinct — desaturated, or dashed as the existing `LineDashedMaterial` path already does for something else in this file.

This addresses a documented reality rather than a cosmetic preference: `CLAUDE.md` records permanent far-side occlusion in sagittal capture (leftKnee visibility 0.27 against 0.84+ on the near side) and a 47° left/right trunk disagreement with *all six* landmarks above threshold. A confident-looking figure drawn over data that uncertain is the thing that destroys an ergonomist's trust. A figure that visibly knows what it couldn't see earns it.

Where a region rejected with `INSUFFICIENT_VISIBILITY`, the corresponding limb must not look identical to a cleanly measured one.

**Size:** small.

---

## 4. Verification bar

Standard gates: `npm test`, `tsc --noEmit`, `biome check`.

Beyond those, and non-negotiable given invariant §2.2:

1. **Round-trip assertion.** Drive a real edit through `applyAngleAdjustments` and inspect the persisted `validatedKeypoints` directly against the DB. Confirm segment lengths match the original sample's, not the manikin's. A passing unit test is not sufficient evidence here — this is the failure mode that silently corrupts data.
2. **`PostureSampleValidationEvent` still writes** on every `PENDING_REVIEW ↔ VALIDATED` transition. None of this touches that path, so a regression there means something was refactored that shouldn't have been.
3. **Re-score an edited sample** through the real `buildRegionResults`/`computeBodyAngles` path and confirm the band matches what the editor displayed.
4. **Visual check on a real device**, since three.js can't be meaningfully unit-tested headlessly. The demo fixture's hero workstation sample (`TRUNK` 74.05° / `NECK` 29.98°, both `HIGH`) is the natural subject — it has known-correct angles to check the render against.

---

## 5. Out of scope — deliberate, not forgotten

- Wrist/hand articulation. Blocked on Hand Landmarker, not on this work.
- Forearm pronation/supination and ankle dorsiflexion. Unobservable from one 2D camera.
- Any second camera, stereo, or depth capability. Still the open decision in `ERGO_COMPLIANCE_BY_DESIGN.md` §5.
- Holding-time, load and repetition scoring. Separate plan.
- Making the editor a primary capture path. It is a correction and communication surface; the camera remains primary.
