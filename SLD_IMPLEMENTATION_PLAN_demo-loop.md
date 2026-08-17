# SLD implementation plan — capture → analyse → act, in one demo account

**Working spec for Claude Code.** Read `ERGO_COMPLIANCE_BY_DESIGN.md` and `CLAUDE.md` first; this document assumes both and does not repeat their mandates.

**Supersedes** the earlier process/risk/action plan. Same three modules, but the organising target is now different: a **demo account that walks the full loop**, with capture from a phone **or** a USB/tripod camera — both supported, neither replacing the other.

---

## 1. Definition of done — the demo walkthrough

This is the acceptance test for everything below. If a step can't be performed live, the milestone isn't finished.

1. Sign in to a **demo account** on a laptop. Land on a site with a real org structure — plant → departments → workstations — and a populated risk register with history.
2. Open a workstation, open a task, hit **Capture** — from **a phone or a USB/tripod camera**, same account, same task. Both paths are first-class; the phone is the new one, not the only one.
3. Frame a person performing the task. If coworkers are in frame, select the correct skeleton. Capture.
4. Scores appear immediately: per-region bands, plus honest non-results (`WRONG_CAMERA_ANGLE`, `INSUFFICIENT_VISIBILITY`) rather than false confidence.
5. Back on the laptop, that sample is already in the workstation's assessment history.
6. Open the workstation's **risk assessment**. The ergonomic finding sits alongside noise, dust, climate and psychosocial findings — one risk vocabulary, one document.
7. Add an **exposure measurement** to a finding (e.g. 89 dB(A) against the 87 dB(A) limit) and watch the band move.
8. Raise an **action** from a finding: owner, due date, hierarchy-of-control level, due date.
9. Mark it implemented, then **verify effectiveness against a re-assessment** — and see the risk band actually drop from the seeded "before" state to the just-captured "after".
10. Site-level view: open actions, overdue actions, findings by category, workstations by highest band.

Step 9 is the whole point. It's the thing no spreadsheet can do, and it only works because the assessment data is objective and already there.

---

## 2. Where the codebase already is

Genuinely done and reusable: the full assessment chain, RBAC with fail-closed access wrappers, versioned `ScoringRule` + `MethodologyVersion` with fail-closed lookup, `computeBodyAngles` with camera-angle and visibility gates, the capture→persistence pipeline including multi-person operator confirmation, per-task PDF report, three-language i18n, `(app)` read-only dashboard, `/admin` super-admin CRUD.

Gaps between here and §1, in dependency order:

| Gap | Nature |
|---|---|
| Phone capture | Small, concrete, but **unproven on a real device** — highest risk |
| Process / risk / action schema | Well-understood, mechanical |
| Write surfaces in `(app)` | New character for that route group (currently read-only by design) |
| Combined analysis views | New — `CLAUDE.md` calls the results dashboard a "planned future phase" |
| Demo fixture with history | New, and the demo's dramatic beat depends on it |

---

## 3. Critical path

Ordered so the riskiest unknown gets tested before anything is designed around it. This is **several focused sessions, not one day** — the earlier one-day framing assumed schema only.

| # | Milestone | Why here |
|---|---|---|
| **M0** | **Phone spike (~60–90 min, throwaway)** | Prove MediaPipe runs on your actual phone over HTTPS before building anything around it |
| **M1** | Docs + decisions | Compliance v1.15, glossary, ROI decision — CC reads these on every later session |
| **M2** | Schema: 5 hand-written migrations + seeds | Prerequisite for everything downstream |
| **M3** | Lib gates + Vitest | The rules, before any UI can violate them |
| **M4** | Mobile capture, properly | Now informed by M0's findings |
| **M5** | Write surfaces: `(app)/administration`, risk entry, actions | The loop becomes walkable |
| **M6** | Analysis views: workstation combined + site rollup | Steps 6 and 10 of the demo |
| **M7** | Demo fixture + walkthrough script | Step 9 becomes possible |
| M8 | *Stretch:* risk-assessment PDF, worker-rep briefing artifact (§3.5) | Credibility artifacts, not demo-critical |

---

## 4. M0 — the phone spike, first

**Do this before writing a line of schema.** A throwaway branch, deleted afterwards. The only question: *does the existing capture page produce a usable skeleton from my phone?*

What you already have working in your favour (verified in the code):

- The model is already **`pose_landmarker_lite` float16** — the smallest variant, self-hosted from `/public/mediapipe`. No model swap needed for mobile.
- `<video>` already has **`playsInline`** — the classic iOS Safari blocker is already handled.
- Permission ordering is already correct: `getUserMedia({video: true})` **first**, then `enumerateDevices()`. This matters because iOS Safari returns empty device labels before a permission grant, and the code already avoids that trap.
- `runningMode: "IMAGE"` with one `detect()` per explicit click — no continuous inference draining a phone battery.
- The video element is `w-full`, so it already scales.

**The blocker to expect, and the fix:** `getUserMedia` requires a **secure context**. `http://192.168.x.x:3000` from your phone is *not* one, so the camera will silently fail no matter what the code does. Options, cheapest first:

1. `next dev --experimental-https` (check the flag against `node_modules/next/dist/docs/` — this Next version differs from training data)
2. A tunnel (cloudflared / ngrok) in front of `next dev`
3. A Vercel preview deploy

**Spike checklist:**

- [ ] Page loads on the phone over HTTPS; camera permission prompt appears
- [ ] WASM + `.task` model actually download over the mobile connection (watch the network panel — this is a self-hosted multi-MB asset)
- [ ] `delegate: "GPU"` initialises. **This is the one likely code-level failure** — `getPoseLandmarker()` in `src/lib/pose/mediapipe-client.ts` hardcodes GPU with no fallback, and mobile browsers are exactly where the GPU delegate fails
- [ ] `detect()` returns landmarks on a real person at 3–5 m
- [ ] Rough latency per capture — if a full-resolution phone frame (often 1920×1080+) is slow, note it
- [ ] The multi-person overlay is tappable with a finger

Record the findings in the spike branch's commit message or a scratch note, then throw the code away. M4 does it properly.

---

## 5. M1 — decisions and docs

`ERGO_COMPLIANCE_BY_DESIGN.md` → **v1.15**:

- **Mandate 3.12** — risk factors are recorded at workstation/process/job level only. `PSYCHOSOCIAL` never holds per-respondent data; if survey capture is ever built it stores aggregates with a documented minimum group size.
- **Mandate 3.13** — action responsibility references `PlatformUser` or a role label, never a shop-floor worker identity.
- **Mandate 3.14** — risk-matrix versions follow `MethodologyVersion`'s fail-closed, single-active-version contract; activation is super_admin-only.
- **§5 — close the ROI open item.** Supporting handheld capture means a per-capture ROI definition must exist regardless, so **per-capture is the mechanism**. Because tripod/USB capture remains supported, a fixed camera may additionally reuse an optional saved per-`Workstation` ROI default, adjustable at capture time. Record it as "per-capture mechanism, optional per-workstation preset" — not as one replacing the other.
- **§5 — new open item:** is an INCDPM/Darabont-shaped risk matrix distributable, or must clients enter their own? (See §7.2.)
- **§5 — demo-capture note:** capturing yourself for a demo is fine. Capturing a prospect's workers in their plant is a pilot and triggers the full pilot documentation stack — Pilot Agreement, DPA, DPIA, worker information, rep consultation. Don't let a "quick demo on site" become an undocumented second pilot.
- §4 never-build additions: no per-person psychosocial score; no worker-identity action assignee; no tenant-writable methodology/matrix activation.

`CLAUDE.md`: new data-model chain; the `(app)` write-surface change (§8); and **update the RLS gotcha's table count from 13 to 24** — M2 adds eleven tables.

**Terminology, locked before any dictionary key is written.** In Romanian OSH law „loc de muncă" is what SLD calls a `Workstation`, not a `Site` — the `evaluarea riscurilor` obligation attaches per *loc de muncă*. Since `de.ts`/`ro.ts` are typed `typeof en`, a missing key is a build error, so churn here is expensive:

| Model | EN | DE | RO |
|---|---|---|---|
| `Site` | Site | Standort | Locație / Unitate |
| `OrgUnit` PLANT | Plant | Werk | Fabrică / Platformă |
| `OrgUnit` DEPARTMENT | Department | Abteilung | Secție |
| `Workstation` | Workstation | Arbeitsplatz | **Loc de muncă** |
| `Task` | Task | Tätigkeit | Activitate |
| `Process` | Process | Prozess | Proces de muncă |
| `RiskAssessment` | Risk assessment | **Gefährdungsbeurteilung** | **Evaluare de riscuri** |
| `Action` | Action | Maßnahme | Măsură corectivă |

`Gefährdungsbeurteilung` and `evaluare de riscuri` are the legally recognised terms, not literal translations.

---

## 6. M2 — schema, in five hand-written migrations

**House rules that dictate this shape** (from `CLAUDE.md`): `prisma migrate dev` does not work against this schema — every migration is hand-written SQL applied with `prisma migrate deploy`, with hand-added constructs re-verified against the live DB afterwards. And **a new enum value can never be referenced in the migration that creates it**, which is why migration A exists.

### Migration A — enums only, nothing else

`OrgUnitType`, `ProcessStatus`, `HazardCategory`, `RiskAssessmentStatus`, `ActionStatus`, `HierarchyOfControl`, `VerificationOutcome`.

### Migration B — org structure

```prisma
enum OrgUnitType { PLANT DEPARTMENT AREA LINE }

/// Organisational structure within a site. Describes the organisation of
/// work, never a person (§1, §3.1). `siteId` is denormalised onto every
/// node deliberately: authorization must never require walking this tree.
model OrgUnit {
  id        String      @id @default(cuid())
  siteId    String
  parentId  String?
  type      OrgUnitType
  name      String
  code      String?
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  site         Site          @relation(fields: [siteId], references: [id], onDelete: Restrict)
  parent       OrgUnit?      @relation("OrgUnitTree", fields: [parentId], references: [id], onDelete: Restrict)
  children     OrgUnit[]     @relation("OrgUnitTree")
  workstations Workstation[]
  processes    Process[]

  @@index([siteId])
  @@index([parentId])
}
```

Plus, on `Workstation`, **additively only**: `orgUnitId String?` + relation.

**The load-bearing decision:** `Workstation.siteId` stays `NOT NULL` and untouched, `orgUnitId` is nullable. That means `canAccessSite`, `requireSiteAccess`, `requireWorkstationAccess`, `requireTaskAccess` and `getAccessibleSites()` all keep working **unchanged**, with no backfill and no RBAC regression risk. The org tree is grouping and presentation layered on an access model that already works — never load-bearing for authorization. Do not later "tidy this up" by making `orgUnitId` required or deriving site from the tree.

### Migration C — process

```prisma
enum ProcessStatus { DRAFT ACTIVE ARCHIVED }

/// A work process: an ordered set of tasks, possibly spanning workstations
/// within one site. Describes work, never a worker (§1).
model Process {
  id          String        @id @default(cuid())
  siteId      String
  orgUnitId   String?
  name        String
  code        String?
  description String?
  status      ProcessStatus @default(DRAFT)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  site            Site             @relation(fields: [siteId], references: [id], onDelete: Restrict)
  orgUnit         OrgUnit?         @relation(fields: [orgUnitId], references: [id], onDelete: Restrict)
  tasks           ProcessTask[]
  riskAssessments RiskAssessment[]

  @@index([siteId])
}

/// Join: which tasks make up a process, in what order. A task may belong to
/// more than one process — same reasoning as AssessmentSessionTask.
model ProcessTask {
  id        String   @id @default(cuid())
  processId String
  taskId    String
  sequence  Int
  createdAt DateTime @default(now())

  process Process @relation(fields: [processId], references: [id], onDelete: Restrict)
  task    Task    @relation(fields: [taskId], references: [id], onDelete: Restrict)

  @@unique([processId, taskId])
  @@index([taskId])
}
```

**No separate `ProcessStep` entity.** `Task` already means "a specific job performed at a workstation"; a process is a sequence of those. A described step with no `Task` is a signal to create the task, not to introduce a parallel model that drifts.

### Migration D — risk core

```prisma
enum HazardCategory {
  PHYSICAL_MECHANICAL NOISE VIBRATION LIGHTING CLIMATE_THERMAL
  CHEMICAL DUST_PARTICULATE BIOLOGICAL ERGONOMIC_MSD
  PSYCHOSOCIAL ELECTRICAL FIRE_EXPLOSION RADIATION
}

/// Hazard catalog. companyId == null = system catalog (seeded, shared,
/// super_admin-only). companyId set = a company's own additions.
model Hazard {
  id          String         @id @default(cuid())
  companyId   String?
  category    HazardCategory
  code        String
  name        String
  description String?
  isSystem    Boolean        @default(false)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  company  Company?      @relation(fields: [companyId], references: [id], onDelete: Restrict)
  findings RiskFinding[]

  @@index([companyId, category])
}

/// Which risk matrix is current is data, not a code constant — same design
/// and same fail-closed contract as MethodologyVersion (§3.8, §3.14).
/// At most one isActive = true, via a HAND-ADDED partial unique index
/// (Prisma has no filtered-index support) — copy
/// MethodologyVersion_isActive_unique_when_true.
model RiskMatrixVersion {
  version     String   @id
  label       String
  isActive    Boolean  @default(false)
  activatedAt DateTime @default(now())

  cells           RiskMatrixCell[]
  riskAssessments RiskAssessment[]
}

model RiskMatrixCell {
  id            String   @id @default(cuid())
  matrixVersion String
  probability   Int
  severity      Int
  riskScore     Int
  riskBand      RiskBand
  createdAt     DateTime @default(now())

  matrix RiskMatrixVersion @relation(fields: [matrixVersion], references: [version], onDelete: Restrict)

  @@unique([matrixVersion, probability, severity])
  @@index([matrixVersion])
}

enum RiskAssessmentStatus { DRAFT IN_REVIEW APPROVED ARCHIVED }

/// A dated risk assessment of either a workstation or a process — exactly
/// one of the two, enforced by a HAND-ADDED CHECK constraint (same
/// technique as ManualInput_value_shape_check).
///
/// DRAFT -> IN_REVIEW -> APPROVED is mandate §3.4 (mandatory human review)
/// expressed as data. Never add an auto-approve path.
///
/// pilotContext mirrors AssessmentSession.pilotContext — internal-only
/// audit metadata (§3.6) marking demo/pilot rows so they stay separable
/// from real customer data.
model RiskAssessment {
  id               String               @id @default(cuid())
  siteId           String
  workstationId    String?
  processId        String?
  matrixVersion    String
  status           RiskAssessmentStatus @default(DRAFT)
  assessorUserId   String               @db.Uuid
  approvedByUserId String?              @db.Uuid
  assessedAt       DateTime
  approvedAt       DateTime?
  pilotContext     String?
  notes            String?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  site            Site              @relation(fields: [siteId], references: [id], onDelete: Restrict)
  workstation     Workstation?      @relation(fields: [workstationId], references: [id], onDelete: Restrict)
  process         Process?          @relation(fields: [processId], references: [id], onDelete: Restrict)
  matrix          RiskMatrixVersion @relation(fields: [matrixVersion], references: [version], onDelete: Restrict)
  findings        RiskFinding[]
  verifiedActions Action[]          @relation("ActionVerificationAssessment")

  @@index([siteId])
  @@index([workstationId])
}

model RiskFinding {
  id                  String    @id @default(cuid())
  riskAssessmentId    String
  hazardId            String
  probability         Int
  severity            Int
  riskScore           Int
  riskBand            RiskBand
  existingControls    String?
  notes               String?
  residualProbability Int?
  residualSeverity    Int?
  residualRiskScore   Int?
  residualRiskBand    RiskBand?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  riskAssessment RiskAssessment        @relation(fields: [riskAssessmentId], references: [id], onDelete: Restrict)
  hazard         Hazard                @relation(fields: [hazardId], references: [id], onDelete: Restrict)
  measurements   ExposureMeasurement[]
  actions        Action[]

  @@index([riskAssessmentId])
}

/// Instrument or survey measurement supporting a finding, with the legal
/// limit it is compared against recorded alongside it.
///
/// Deliberately NOT merged with ManualInput despite the similar shape:
/// ManualInput is task-level input feeding the CV scoring path, this is
/// environmental data supporting a risk finding. Same shape, different
/// lifecycle and consumer — do not "DRY" them together.
model ExposureMeasurement {
  id             String   @id @default(cuid())
  riskFindingId  String
  value          Float
  unit           String
  limitValue     Float?
  limitReference String?
  instrument     String?
  method         String?
  measuredAt     DateTime
  notes          String?
  createdAt      DateTime @default(now())

  riskFinding RiskFinding @relation(fields: [riskFindingId], references: [id], onDelete: Restrict)

  @@index([riskFindingId])
}
```

**Reuse the existing `RiskBand` enum** (`LOW | MODERATE | ELEVATED | HIGH`) rather than inventing a second scale. Ergonomic scores and risk findings then speak one vocabulary, which is exactly what makes the combined view in demo step 6 coherent — and it costs nothing.

`lookupRiskMatrixCell()` mirrors `lookupScoringRule()`: `null` on no match, **throw** on ambiguity, and zero active versions is a misconfiguration that throws — never a silent fallback.

### Migration E — actions

```prisma
enum ActionStatus { OPEN IN_PROGRESS IMPLEMENTED VERIFIED CANCELLED }
enum HierarchyOfControl {
  ELIMINATION SUBSTITUTION ENGINEERING_CONTROL
  ADMINISTRATIVE_CONTROL PPE
}
enum VerificationOutcome { EFFECTIVE PARTIALLY_EFFECTIVE NOT_EFFECTIVE }

/// A corrective action from a risk finding or an ergonomic assessment
/// session — exactly one source, HAND-ADDED CHECK.
///
/// responsibleUserId references PlatformUser only (§3.13). Where the owner
/// is a function rather than an account, use responsibleRoleLabel — a role,
/// never a person's name.
model Action {
  id                       String   @id @default(cuid())
  siteId                   String
  riskFindingId            String?
  assessmentSessionId      String?
  title                    String
  description              String?
  hierarchyOfControl       HierarchyOfControl?
  responsibleUserId        String?  @db.Uuid
  responsibleRoleLabel     String?
  dueDate                  DateTime?
  status                   ActionStatus @default(OPEN)
  implementedAt            DateTime?
  verifiedAt               DateTime?
  verifiedByUserId         String?  @db.Uuid
  verificationOutcome      VerificationOutcome?
  verificationAssessmentId String?
  verificationNote         String?
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  site                   Site               @relation(fields: [siteId], references: [id], onDelete: Restrict)
  riskFinding            RiskFinding?       @relation(fields: [riskFindingId], references: [id], onDelete: Restrict)
  assessmentSession      AssessmentSession? @relation(fields: [assessmentSessionId], references: [id], onDelete: Restrict)
  verificationAssessment RiskAssessment?    @relation("ActionVerificationAssessment", fields: [verificationAssessmentId], references: [id], onDelete: Restrict)
  statusEvents           ActionStatusEvent[]

  @@index([siteId, status])
  @@index([riskFindingId])
}

/// Append-only status history (§3.6). Never updated, never deleted.
model ActionStatusEvent {
  id         String        @id @default(cuid())
  actionId   String
  fromStatus ActionStatus?
  toStatus   ActionStatus
  byUserId   String        @db.Uuid
  note       String?
  createdAt  DateTime      @default(now())

  action Action @relation(fields: [actionId], references: [id], onDelete: Restrict)

  @@index([actionId])
}
```

**Two source FKs, not four.** Ergonomic findings roll up to their `AssessmentSession` rather than to an individual `BodyRegionScore` — keeps the CHECK simple and matches how an EHS manager actually raises an action ("this workstation's assessment found X"), not per-joint.

### Seeds

- System hazard catalog covering all `HazardCategory` values, with enough industrial specificity to be credible: respirable dust, formaldehyde/resin vapour, press-line noise, thermal load, manual panel handling, dust-explosion/ATEX, adhesives and lacquers, hand-arm vibration, shift-work load.
- **`v1-generic-5x5`** — a plain 5×5 probability × severity matrix, independently defined, activated.

**Do not seed an INCDPM/Darabont-shaped matrix.** It's the Romanian de-facto standard and clients will ask, but §3.7's discipline (independently named methodology, no third-party licensing dependency) applies to risk matrices as much as to ergonomic scoring. Per-client matrix versions turn this into a feature, not a gap. Logged as a §5 open question.

**RLS:** enable on all eleven new tables for consistency with the existing thirteen; still no policies (the owning DB role bypasses). The existing "add policies before narrowing the DB role" warning now covers 24 tables.

---

## 7. M3 — lib gates and tests

One creation/transition function per rule, following the `createAssessmentSession()` pattern: nothing calls `prisma.X.create` directly for these.

| Function | Enforces |
|---|---|
| `createOrgUnit` | `parent.siteId === siteId`; no cycles (walk the parent chain); `MAX_ORG_UNIT_DEPTH`; fails closed |
| `createProcess` | site scoping |
| `addTaskToProcess` | `task.workstation.siteId === process.siteId` — the check that stops a process reaching across sites |
| `lookupRiskMatrixCell` | `null` on no match, throw on ambiguity, throw on no active version |
| `createRiskAssessment` | exactly one of `workstationId` / `processId`; matrix version resolved from the active row, never passed in blind |
| `transitionAction` | legal status transitions; `→ VERIFIED` requires a `verificationOutcome` **and** either a `verificationAssessmentId` or an explicit documented override note; writes `ActionStatusEvent` in the same transaction |

Unit-test the pure logic in the style of `src/lib/scoring/lookup.test.ts` — matrix lookup, cycle detection, transition legality, and the exactly-one-subject rule are all pure and deserve direct coverage.

---

## 8. M4 — capture on phone **and** USB/tripod camera (parity, not replacement)

Informed by M0. Everything here is a targeted change to `src/app/(app)/tasks/[taskId]/capture/page.tsx` and `src/lib/pose/mediapipe-client.ts` — no architectural change.

**Non-goal, stated explicitly because it is easy to break by accident: mobile capture is *additive*.** USB webcam, built-in laptop camera, and tripod-mounted USB camera remain fully supported, first-class capture paths. Nothing in this milestone removes, hides, or deprioritises them. The existing device `<select>` (populated from `enumerateDevices()`) stays visible and functional on every form factor — it is the primary control on desktop, not a fallback. Any change here must be regression-tested on a desktop USB camera before it is considered done.

Two reasons this matters beyond convenience: a fixed tripod camera gives **repeatable framing** across re-assessments, which is what makes a before/after comparison methodologically defensible; and a fixed camera is the better compliance posture, because stable framing makes ROI restriction and bystander avoidance practical in a way handheld never will.

**1. Correct default camera per form factor — without changing desktop behaviour.** The initial permission request uses plain `video: true`, so a *phone* hands back the front camera — wrong for filming someone at 3–5 m. Add `facingMode: { ideal: "environment" }` to the initial request. `ideal` is a soft constraint, so on a desktop with no environment-facing device it is simply ignored and current behaviour is preserved — that is exactly why `ideal` and not `exact`.

For auto-selection after enumeration, guard the heuristic: prefer a rear device **only when a device actually reports `facingMode === "environment"`**. Desktop and USB cameras commonly report no `facingMode` at all, so a naive "prefer rear" rule would either mis-select or select nothing. When no environment-facing device is reported, fall back to the existing behaviour unchanged (the current stream's device, else the first video input). Keep the permission-then-`enumerateDevices()` ordering, which is already correct for iOS label visibility.

**2. GPU → CPU delegate fallback.** `getPoseLandmarker()` hardcodes `delegate: "GPU"` with no fallback. Wrap creation so a GPU failure retries with `delegate: "CPU"`, and surface which delegate is active in dev. This is the most likely mobile-only failure in the whole app.

**3. Touch targets.** The multi-person selector positions its buttons as percentage-sized boxes over the detected skeletons, so a distant person yields a tap target too small for a finger. Enforce a minimum hit area (~44 px) independent of box size, and keep the visual box as-is.

**4. Layout at ~390 px.** The container is `mx-auto flex max-w-3xl flex-col gap-6 p-8` — reduce padding at small widths and let the camera/angle controls stack. Reuse the existing `860px` responsive floor convention rather than introducing a new breakpoint.

**5. Capture-angle guidance.** `CameraAngle` is operator-declared, not detected, and the SAGITTAL/FRONTAL choice determines which regions can be scored at all. On a phone this needs to be unmissable — a short inline hint of what the chosen angle expects, in all three languages.

**6. Optional, only if M0 showed latency — and conditional, never blanket.** Downscaling the captured frame before `detect()` would cut work on a phone, where `videoWidth × videoHeight` is often 1920×1080 or larger. But **do not apply this unconditionally**: downscaling discards pixels that landmark placement is derived from, and landmark precision is what every computed angle depends on. Given the known confident-but-wrong failure mode (the 47° left/right trunk disagreement, with all six landmarks above the visibility threshold), degrading input resolution to save milliseconds is a bad trade on any device that doesn't need it.

If implemented: cap the long edge at a named constant, apply it only when the source exceeds that cap, leave a high-resolution tripod/USB feed untouched, and treat the constant as an accuracy-affecting parameter — documented, not silently tuned.

**Two follow-ups this milestone triggers:**

- **ROI: per-capture is the mechanism, with an optional saved default for fixed installations.** The §5 open item asked "persistent per-`Workstation` property or per-capture definition"; supporting handheld phones means per-capture must exist regardless, so that is the mechanism to build. But because tripod/USB capture stays supported, a fixed camera can reasonably reuse a saved per-workstation ROI *default* that the operator can still adjust or clear at capture time. Per-capture as the mechanism, per-workstation as an optional preset — not either/or. Record it that way in M1.
- The marketing page lists **mobile capture mode as a roadmap item**, deliberately styled distinctly (dashed border, mono type) so it can't read as a shipped capability. When this ships, move it — leaving a shipped feature in the roadmap block is as much a misrepresentation as the reverse.

---

## 9. M5 — write surfaces

**Route-naming collision, read before creating anything:** `/admin` (`src/app/admin/**`) is the **super_admin internal tool** — unstyled, `requireSuperAdmin()`, deliberately ugly. It is not the client-facing administration area. The tenant-facing surface goes at **`src/app/(app)/administration/**`**, inside the themed dashboard route group.

This makes it the **first write surface in `(app)`**, which `CLAUDE.md` currently describes as read-only by design. That's a deliberate change of character — record it, don't let it happen silently.

Write permissions, split on purpose:

| Section | Contents | Who writes |
|---|---|---|
| Master data | Org units, workstations, processes, tasks | `company_admin`; `site_admin` within assigned sites |
| Catalogs | Company hazard additions, units, exposure-limit references | `company_admin` |
| System catalog | System hazards (`companyId == null`) | **`super_admin` only** |
| System configuration | Active `RiskMatrixVersion`, active `MethodologyVersion`, `CONTINUOUS` flag | **`super_admin` only** |
| Links | Task ↔ process, workstation ↔ org unit | `company_admin` |

**Why the split matters:** a tenant flipping the active methodology or matrix version would destroy the reproducibility guarantee the entire versioned-scoring design exists to provide — which version was active when a score was produced must stay reconstructable. Same for the `CONTINUOUS` flag, which additionally requires a documented worker-rep consent artifact per deployment (§3.11) and must never become a checkbox a client can tick alone.

Then the two flows the demo needs: **risk assessment entry** (create → add findings from the hazard catalog → probability/severity via matrix lookup → attach exposure measurements → submit for review → approve) and **action management** (raise from a finding, assign, transition, verify against a re-assessment).

Server Action validation errors in `/admin` are currently plain English — a known gap. Don't extend that gap into `(app)`, where the user-facing i18n contract applies.

---

## 10. M6 — analysis views

Two pages. Resist building a full BI layer.

**Workstation combined view** — one page answering "what is the risk here": latest approved risk assessment with findings by category and band, ergonomic scores from `AssessmentSession`/`PostureSample` (reuse `buildRegionResults()`, don't re-derive), exposure measurements against limits, open actions, and the band trend across assessments.

**Site rollup** — workstations ranked by highest band, findings by hazard category, open actions, overdue actions, actions awaiting verification.

Keep the `POST /api/posture-samples` response shape and the underlying tables presentation-agnostic — `CLAUDE.md` is explicit that a future dashboard should be a new consumer of the same routes, not a reshaping of them.

---

## 11. M7 — the demo fixture

### Seed the past, capture the present

The demo's payoff is step 9: a risk band visibly dropping because an action worked. That can't happen live in five minutes — unless the history already exists. So:

- Seed a **"before" risk assessment** dated some months back, APPROVED, with an `ERGONOMIC_MSD` finding at `HIGH`, plus noise and dust findings.
- Seed an **action** against that finding — an `ENGINEERING_CONTROL`, e.g. a lift table — status `IMPLEMENTED`, with an `implementedAt` after the assessment.
- Seed matching **"before" posture samples** with genuinely poor trunk/neck angles.
- Leave the **"after" assessment empty**. The live phone capture in the demo *becomes* the after state, and verifying the action against it closes the loop in real time.

That's what makes a two-minute capture feel consequential instead of like a gadget.

### Fixture hygiene

- **A separate script**: `scripts/seed-demo-fixture.mjs`, `npm run seed:demo`. Keep it out of `seed-dev-fixture.mjs` so dev testing and demo data can't contaminate each other.
- **Tag every session and assessment** with `pilotContext` — `"DEMO — not customer data"`. That field exists precisely for telling pilot/test rows from real ones (§3.6), and this is exactly its purpose.
- **Demo user is `company_admin`** so it can write in `(app)/administration` and see multiple sites.
- **A reset path**, because demo accounts get messy — but §3.9 makes hard deletion a deliberate, logged action, never a casual one. So: the reset script must **refuse to run** against any company whose name doesn't carry the demo marker, and must log what it removed. A reset script that can be pointed at a real tenant is a data-loss incident waiting to happen.
- **Realistic org structure**: one company, one site, plant → 3–4 departments, 6–8 workstations, 2–3 tasks each, two processes spanning workstations.

### One compliance line to hold

Capturing yourself, or a consenting colleague, for a demo is fine — no frames persist, no identity is stored. Capturing a prospect's workers on their shop floor is a **pilot**, and triggers the full documentation stack (Pilot Agreement, DPA, DPIA, worker information, rep consultation). The first pilot happened without most of that; §5 now treats it as a hard prerequisite. Don't let "just a quick demo on site" quietly become pilot number two.

---

## 12. Verification bar

Match what this repo already does, which is more than most projects:

- After each migration: re-verify hand-added constraints against the live DB (`\d+ table`), confirm RLS enabled, confirm no unintended `DROP CONSTRAINT` slipped in.
- **Prove the CHECK constraints reject**: insert a `RiskAssessment` with both `workstationId` and `processId` set and confirm the *database* refuses it, not just the app layer. Same for `Action`'s two sources.
- Prove `transitionAction` refuses `→ VERIFIED` without a verification reference.
- `npm test` green; Biome clean (not `next lint`).
- **The whole of §1 twice: once with a phone camera, once with a USB/laptop camera**, against a running server — not inferred from passing tests. Desktop capture is an existing working path and a regression there is a regression, not a tradeoff. That's the standard the capture pipeline and the PDF report were already held to.

---

## 13. CC prompt sequence

One prompt per milestone; front-load the constraints CC can't infer.

**M0**
> Throwaway spike branch, no production changes. I need to know whether the existing capture page works from my phone. Tell me how to serve `next dev` over HTTPS in this Next version (check `node_modules/next/dist/docs/` — this version differs from your training data), then walk me through testing on a real device. Focus on: does the GPU delegate in `getPoseLandmarker()` initialise on mobile, and does `detect()` return landmarks on a person at 3–5 m. Don't fix anything yet — just find out what breaks. Note also: USB/webcam capture must keep working throughout this work, so record the current desktop behaviour as a baseline before touching anything.

**M1**
> Read `ERGO_COMPLIANCE_BY_DESIGN.md` and `CLAUDE.md` fully. No code this step. Update the compliance doc to v1.15: add mandates 3.12 (risk factors job/workstation-level only, psychosocial never per-respondent), 3.13 (action responsibility is PlatformUser or role label, never a worker identity), 3.14 (risk matrix versions follow the MethodologyVersion fail-closed contract, super_admin-only activation); close the §5 ROI item as "per-capture mechanism with an optional saved per-workstation preset for fixed cameras"; add §5 open items for INCDPM matrix distributability and the demo-vs-pilot documentation line; add the matching §4 never-build entries. Then update `CLAUDE.md`'s data-model section, the `(app)` write-surface note, and the RLS table count from 13 to 24.

**M2a**
> Hand-write a migration adding **only** these Postgres enums — no tables, no columns, because a new enum value can't be referenced in the migration that creates it: `OrgUnitType`, `ProcessStatus`, `HazardCategory`, `RiskAssessmentStatus`, `ActionStatus`, `HierarchyOfControl`, `VerificationOutcome`. Apply with `prisma migrate deploy` and verify against the live DB.

**M2b**
> Add `OrgUnit` per the plan: self-referencing tree rooted at Site, `siteId` denormalised on every node, `Workstation.orgUnitId` nullable. Critically: do not change `Workstation.siteId` and do not touch any authorization code — `canAccessSite` and the `require*Access` wrappers must keep working unchanged. Enable RLS, no policies.

…continuing one migration per prompt. For **M2d**, explicitly instruct the hand-added partial unique index and the exactly-one-subject CHECK, pointing CC at `MethodologyVersion_isActive_unique_when_true` and `ManualInput_value_shape_check` as the patterns to copy.

---

## 14. What not to let drift

**Superseded (August 2026) — see `SLD_IMPLEMENTATION_PLAN_austria-first.md` §1.** The paragraph below described camera-based scoring as the moat. That framing has been retired, not the underlying architecture: the risk register, versioned scoring, and the verification loop it enabled are exactly what made the reframe possible. The differentiator is now stated as *a country-scoped, version-pinned, fully traceable assessment record that produces the legally required document — and then proves, against a re-assessment, that the measures actually worked.* The camera is kept as an optional evidence-quality upgrade on an input the tool accepts either way, not the reason to buy. Original text preserved below for the historical record of how this plan reasoned at the time.

The moat is camera-based ergonomic scoring on public ISO 11228 / EN 1005 standards, with versioned reproducible rules and honest failure modes. The risk register and action tracking are table stakes — every established EHS suite has them — and they're worth building because they make SLD a system of record rather than a gadget. But they are not the differentiator.

The one genuinely differentiated feature in this whole plan is **effectiveness verification against a re-assessment that shows the score actually fell**, and it only works *because* objective assessment data is already there. This part held: it's exactly what `SLD_IMPLEMENTATION_PLAN_austria-first.md` promotes to the top of the priority table (B6) rather than revising.

Build the register so the loop closes around the camera, not the other way round.
