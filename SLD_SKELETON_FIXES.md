# SLD skeleton — four targeted fixes

**Context:** Read `ERGO_COMPLIANCE_BY_DESIGN.md`, `CLAUDE.md`, and `SLD_POSTURE_EDITOR_FIDELITY_PLAN.md` first. This brief addresses four specific visual/interaction issues visible in the current editor. Run `npm test`, `tsc --noEmit`, and `biome check` after each fix — do not batch.

---

## Fix 1 — Neck: two lines → one

**Problem:** `BODY_REGION_BONES.NECK` maps to two segments (`NOSE→LEFT_SHOULDER`, `NOSE→RIGHT_SHOULDER`), rendering a V-shape where the neck should be. The user sees two red lines splaying from head to shoulders.

**File:** `src/lib/pose/skeleton.ts`

Change the NECK entry in `BODY_REGION_BONES` to use a **single virtual segment** from the shoulder midpoint to the nose. The shoulder midpoint is not a real landmark index, so this needs the same synthetic-index approach already used for `VIRTUAL_CHEST_LANDMARK_INDEX`.

However, the simpler path: `BODY_REGION_BONES` is only consumed by the renderer to decide which line segments to colour per region. In `skeleton-3d.tsx`, the NECK region can be rendered as a single capsule/cylinder from shoulder-midpoint to nose-position, computed at render time — the same midpoint calculation `getVirtualChestPosition` already does. This avoids adding another virtual landmark index.

```ts
// In the bone-rendering loop, special-case NECK:
const shoulderMid = positions[LANDMARK_INDEX.LEFT_SHOULDER]
  .clone()
  .add(positions[LANDMARK_INDEX.RIGHT_SHOULDER])
  .multiplyScalar(0.5);
// Render one capsule from shoulderMid to positions[LANDMARK_INDEX.NOSE]
```

Update `BODY_REGION_BONES.NECK` to a single entry or mark it as renderer-handled. The `NECK` drag handle stays on `NOSE` — that's correct (`JOINT_REGIONS` already maps `NOSE → "NECK"`).

---

## Fix 2 — Trunk: wireframe box → solid torso

**Problem:** The trunk renders as four line segments (the edges of the shoulder-hip rectangle). It looks like a wireframe box, not a human torso.

**File:** `src/components/skeleton-3d.tsx`

Replace the four TRUNK bone-lines with a **single solid mesh** — a flattened capsule or a tapered cylinder — spanning from the shoulder midpoint to the hip midpoint, with width derived from shoulder width and tapering slightly toward the hips (shoulder width × 0.85 at the hip end approximates a male torso silhouette; don't over-model this).

Construction:

```ts
const shoulderMid = getVirtualChestPosition(positions);
const hipMid = getVirtualHipPosition(positions);  // already exists
const shoulderWidth = positions[LANDMARK_INDEX.LEFT_SHOULDER]
  .distanceTo(positions[LANDMARK_INDEX.RIGHT_SHOULDER]);

// A CylinderGeometry with different top/bottom radii gives a tapered torso
const torsoLength = shoulderMid.distanceTo(hipMid);
const geo = new THREE.CylinderGeometry(
  shoulderWidth * 0.45,   // top radius (shoulders)
  shoulderWidth * 0.38,   // bottom radius (hips, slightly narrower)
  torsoLength,            // height
  8,                      // radial segments
);
const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
  color: regionColor,     // from the existing TRUNK band colour
  transparent: true,
  opacity: 0.85,
}));

// Position at midpoint, orient along shoulder→hip direction
const dir = new THREE.Vector3().subVectors(hipMid, shoulderMid);
mesh.position.copy(shoulderMid).addScaledVector(dir, 0.5);
mesh.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 1, 0),  // CylinderGeometry's default axis
  dir.normalize(),
);
```

The TRUNK drag handle (virtual chest at shoulder midpoint) stays — its cyan halo should render on the front surface of the torso mesh, not floating in space.

**Remove** the four `TRUNK` bone-line entries from the line-rendering loop. They're the wireframe ghost behind the solid mesh.

---

## Fix 3 — Upper leg (hip flexion) has no slider

**Problem:** `REGION_ORDER` includes `"HIP"`, but `HIP` is not in `JOINT_REGIONS` and not in `ANATOMICAL_LIMITS`, so it falls through to `SharedMeasurementRegionRow` (a read-only label) or `PositionOnlyRegionRow`. The user cannot adjust the thigh angle.

**Why it was missing:** The original design treated HIP as position-only (translate, not rotate) because "hip angle" using the shoulder-hip-knee triangle is geometrically dependent on TRUNK. That reasoning holds for the trunk-relative measurement, but **hip flexion** — the angle of the thigh relative to vertical — is independent of trunk flexion and ergonomically meaningful (seated work, pedal operation).

**This requires a careful decision. Two options:**

### Option A — Add HIP_LEFT / HIP_RIGHT as scored angle regions (recommended)

The angle: vertical → hip → knee, measured per side. This IS independent of trunk.

**Files to change:**

1. `src/lib/pose/angles.ts` — add `hipFlexion(side)`: angle between the vertical reference line and the hip→knee vector, same convention as trunk (0° = standing upright, increases with flexion).

2. `src/lib/pose/skeleton.ts`:
   - Add `HIP_LEFT` and `HIP_RIGHT` to `ANATOMICAL_LIMITS` — range `{ min: 0, max: 120 }` (standing to deep seated).
   - These are NOT in the Prisma `BodyRegion` enum yet as left/right variants. The enum has only `HIP` (bilateral). **Do not modify the Prisma schema in this brief.** Instead, use the existing `HIP` region with a single bilateral angle (average of left/right, same as `TRUNK` averages the two sides). Add it to `ANATOMICAL_LIMITS`:
     ```ts
     HIP: { min: 0, max: 120 },
     ```
   - Add a `JOINT_REGIONS` entry. Since HIP is bilateral like TRUNK, use the existing `VIRTUAL_HIP_LANDMARK_INDEX`:
     ```ts
     [VIRTUAL_HIP_LANDMARK_INDEX]: "HIP",
     ```

3. `src/lib/pose/forward-kinematics.ts` — add `applyHipRotation`: rotates both legs (hip→knee→ankle chains) around the hip midpoint by the requested angle delta. Same pattern as `applyTrunkRotation` but rotating the lower body instead of the upper.

4. `src/lib/pose/drag-to-angle.ts` — add `HIP` to the drag computation (dragging the virtual hip handle vertically changes hip flexion angle).

5. `src/components/posture-editor.tsx` — `HIP` is already in `REGION_ORDER`. Once it's in `JOINT_REGIONS`, it automatically enters `ANGLE_EDITABLE_REGIONS` and gets a `RegionRow` with slider + number input. No change needed in the component itself.

**No scoring rules needed yet.** `lookupBand` already returns `null` for regions with no seeded rules (the test at line 159 of `lookup.test.ts` explicitly tests this with `HIP`). The slider and drag will work; the band dot will show "not assessed." Scoring rules are a separate decision (future methodology version).

### Option B — Keep HIP as display-only, add a note

If adding an angle feels premature, at minimum change `HIP` from `SharedMeasurementRegionRow` to showing the computed angle read-only (no slider), so the user can see the thigh position. This is less useful but lower risk.

**Recommendation:** Option A. The angle computation is straightforward, the FK is the same pattern as trunk, and "hip flexion" is in every OWAS/REBA/RULA sheet that exists. Leaving it uncontrollable in a posture editor is a gap users will keep noticing.

---

## Fix 4 — Wrist/ankle need drag handles (as ELBOW/KNEE proxies)

**Problem:** After P1 removed position-only dragging, wrist and ankle landmarks have no drag handle. The user cannot grab the end of a forearm or shin to adjust elbow/knee angle. You can only drag the elbow/knee joint itself, which is unintuitive — people expect to grab the hand/foot and swing it.

**Solution:** Add **proxy drag handles** at wrist and ankle that resolve to `ELBOW` and `KNEE` respectively.

**File:** `src/lib/pose/drag-to-angle.ts`

The change is small. `bodyRegionForJoint` currently returns `undefined` for wrist/ankle landmarks. Instead:

```ts
// Proxy handles: dragging the wrist adjusts ELBOW angle,
// dragging the ankle adjusts KNEE angle.
// The angle is computed at the elbow/knee vertex regardless —
// computeAngleFromDrag already uses the parent-joint-child triplet,
// not the dragged landmark itself, to compute the angle.
const PROXY_REGIONS: Readonly<Record<number, BodyRegion>> = {
  [LANDMARK_INDEX.LEFT_WRIST]: "ELBOW_LEFT",
  [LANDMARK_INDEX.RIGHT_WRIST]: "ELBOW_RIGHT",
  [LANDMARK_INDEX.LEFT_ANKLE]: "KNEE_LEFT",
  [LANDMARK_INDEX.RIGHT_ANKLE]: "KNEE_RIGHT",
};
```

Then in `bodyRegionForJoint`, fall through to `PROXY_REGIONS` when `JOINT_REGIONS` has no entry.

**Important:** `computeAngleFromDrag` computes the angle at the *joint vertex*, not at the dragged point. For `ELBOW_LEFT`, the vertex is `LEFT_ELBOW` and the angle uses `LEFT_SHOULDER → LEFT_ELBOW → LEFT_WRIST`. When the user drags the wrist, the function needs the wrist's new position as the "child" end of the triplet, with the elbow staying fixed as the vertex. Check that `computeAngleFromDrag`'s current implementation handles this correctly — it may currently assume the dragged point IS the vertex. If so, add a branch: when the dragged landmark is a proxy, use it as the child position and keep the vertex landmark at its current position.

**File:** `src/components/posture-editor.tsx`

Add the four proxy landmark indices to `DRAGGABLE_JOINTS`:

```ts
const DRAGGABLE_JOINTS = [
  ...Object.keys(JOINT_REGIONS).map(Number),
  LANDMARK_INDEX.LEFT_WRIST,
  LANDMARK_INDEX.RIGHT_WRIST,
  LANDMARK_INDEX.LEFT_ANKLE,
  LANDMARK_INDEX.RIGHT_ANKLE,
];
```

**File:** `src/components/skeleton-3d.tsx`

Render proxy handles with a **smaller radius** than scored-joint handles and **no halo** — visually distinct from the eight primary handles, clearly grabbable but secondary. This avoids the original problem (wrist/ankle looked identical to scored joints and confused users about what was measurable).

```ts
const PROXY_JOINT_RADIUS = 0.015;  // half of DRAGGABLE_JOINT_RADIUS
// No halo — proxy handles don't score anything themselves
```

---

## Ghost wireframes

There are green wireframe outlines visible behind the solid meshes in the screenshot. This is the **old line-segment renderer still drawing** alongside the new mesh renderer. After implementing fixes 1–2, confirm that every bone in `BODY_REGION_BONES` is rendered **either** as a line segment **or** as a solid mesh, never both. TRUNK and NECK should be mesh-only after these fixes. All other regions (shoulders, elbows, knees) should be one or the other — pick consistently.

If the wireframes are from P5's confidence rendering (`wireframe: true` on low-visibility limbs), replace with **opacity reduction**:

```ts
// Instead of:  material.wireframe = true
// Use:
material.opacity = 0.35;
material.transparent = true;
```

Wireframe reads as "broken asset." Transparency reads as "we're less sure about this one."

---

## Verification

After all four fixes:

1. Eight drag handles (trunk, neck, shoulders ×2, elbows ×2, knees ×2) plus one hip handle (Fix 3A) plus four proxy handles (Fix 4) = **13 total handles**. The eight scored + hip have full-size cyan halos; the four proxies are smaller, no halo.
2. Every handle that can be grabbed and released either changes an angle or shows a clamp message. No silent reverts.
3. The trunk is a solid tapered shape, not a wireframe rectangle.
4. The neck is a single segment from shoulder midpoint to head, not a V.
5. HIP has a slider in the panel (if Option A).
6. No wireframe ghosts behind solid meshes.
7. `npm test`, `tsc --noEmit`, `biome check` all clean.
8. Round-trip: drag a proxy handle (wrist), confirm the ELBOW angle changes in the slider panel, confirm `validatedKeypoints` contains real landmark coordinates (not manikin coordinates).
