// The demo account fixture (SLD_IMPLEMENTATION_PLAN_demo-loop.md M7): a
// realistic org structure plus a seeded "before" state, so the live demo
// walkthrough's payoff — verifying an action's effectiveness against a
// fresh re-assessment and watching the risk band actually drop — can
// happen in minutes instead of needing months of real history.
//
// Deliberately separate from seed-dev-fixture.mjs (different company,
// different purpose) so dev testing and demo data can never contaminate
// each other. Same plain-`pg`-over-raw-SQL style as that script, no Prisma
// client — this is a one-off maintenance script, not application code.
//
// Idempotent for the *structural* entities (Company/Site/OrgUnit/
// Workstation/Task/Process/ProcessTask/FloorPlan/WorkstationPlanPosition/
// TaskPlanPosition — matched by name (or by floorPlanId+workstationId/
// taskId for the two position tables) within their parent, same
// selectOrInsert pattern as seed-dev-fixture.mjs). The
// "historical demo narrative" (risk assessments/findings/actions/posture
// sample) is seeded as one all-or-nothing block, gated on whether the
// hero workstation's "before" RiskAssessment already exists — re-running
// this script is safe, but the intended reset path for a messy demo
// account is `npm run reset:demo` followed by a fresh `npm run seed:demo`,
// not relying on fine-grained event-level dedup.
//
// Usage: npm run seed:demo
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import pg from "pg";
import { PNG } from "pngjs";
import { DEMO_COMPANY_NAME } from "./demo-fixture-constants.mjs";

const DEMO_EMAIL = "demo-admin@statura.local";
// Deliberately simple (no symbols, no shift key) — this account is typed
// on a phone keyboard during live walkthroughs, where a long/symbol-heavy
// password is genuinely hard to enter correctly before a page reload.
const DEMO_PASSWORD = "demo1234";
const DEMO_NAME = "Statura Demo Account";
const DEMO_SITE_NAME = "Riverside Fabrication Plant";

// §3.6: internal-only audit-trail metadata marking every session/
// assessment this script creates as demo/test data, never customer data —
// exactly what AssessmentSession.pilotContext / RiskAssessment.pilotContext
// exist for.
const DEMO_PILOT_CONTEXT = "DEMO — not customer data";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Unlike seed-dev-fixture.mjs's version of this helper, whereCols here can
// legitimately carry a `null` (the root OrgUnit's parentId) — SQL's
// `"col" = $n` with a null-bound parameter never matches anything (NULL
// comparisons are neither true nor false), which silently breaks
// idempotency instead of erroring, so this needs `IS NULL` for those
// columns specifically rather than a parameterized equality.
async function selectOrInsert(db, table, whereCols, insertCols) {
  const keys = Object.keys(whereCols);
  const params = [];
  const conditions = keys.map((k) => {
    const v = whereCols[k];
    if (v === null) return `"${k}" IS NULL`;
    params.push(v);
    return `"${k}" = $${params.length}`;
  });
  const existing = await db.query(
    `SELECT * FROM "${table}" WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params,
  );
  if (existing.rows.length > 0) {
    return { row: existing.rows[0], created: false };
  }

  const cols = Object.keys(insertCols);
  const columnList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const inserted = await db.query(
    `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) RETURNING *`,
    Object.values(insertCols),
  );
  return { row: inserted.rows[0], created: true };
}

async function insertRow(db, table, insertCols) {
  const cols = Object.keys(insertCols);
  const columnList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const inserted = await db.query(
    `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) RETURNING *`,
    Object.values(insertCols),
  );
  return inserted.rows[0];
}

async function getActiveVersion(db, table) {
  const result = await db.query(
    `SELECT version FROM "${table}" WHERE "isActive" = true LIMIT 1`,
  );
  if (result.rows.length === 0) {
    throw new Error(
      `No active row in ${table} — cannot seed demo data without one`,
    );
  }
  return result.rows[0].version;
}

// Mirrors lookupRiskMatrixCell (src/lib/risk/matrix-lookup.ts): a plain
// script can't import that TS module directly, so this reads the same
// RiskMatrixCell table it does — one source of truth for the actual
// thresholds, no duplicated banding logic.
async function getMatrixCell(db, matrixVersion, probability, severity) {
  const result = await db.query(
    `SELECT "riskScore", "riskBand" FROM "RiskMatrixCell" WHERE "matrixVersion" = $1 AND probability = $2 AND severity = $3`,
    [matrixVersion, probability, severity],
  );
  if (result.rows.length !== 1) {
    throw new Error(
      `Expected exactly one RiskMatrixCell for (${probability}, ${severity}) under ${matrixVersion}, found ${result.rows.length}`,
    );
  }
  return result.rows[0];
}

// Mirrors matchScoringRule (src/lib/scoring/lookup.ts)'s inclusive-min/
// exclusive-max range convention, reading the same ScoringRule table
// rather than duplicating the threshold numbers here.
async function getScoringRule(db, methodologyVersion, bodyRegion, degrees) {
  const result = await db.query(
    `SELECT * FROM "ScoringRule" WHERE "methodologyVersion" = $1 AND "bodyRegion" = $2
       AND ("angleMin" IS NULL OR "angleMin" <= $3)
       AND ("angleMax" IS NULL OR "angleMax" > $3)`,
    [methodologyVersion, bodyRegion, degrees],
  );
  if (result.rows.length !== 1) {
    throw new Error(
      `Expected exactly one ScoringRule for ${bodyRegion} at ${degrees}° under ${methodologyVersion}, found ${result.rows.length}`,
    );
  }
  return result.rows[0];
}

// Mirrors lookupExposureLimits (src/lib/risk/exposure-limit-lookup.ts):
// reads the same ExposureLimit table rather than hardcoding the Austrian
// action/limit values a second time in this script.
async function getExposureLimit(db, catalogVersion, country, parameterKey) {
  const result = await db.query(
    `SELECT * FROM "ExposureLimit" WHERE "catalogVersion" = $1 AND country = $2 AND "parameterKey" = $3`,
    [catalogVersion, country, parameterKey],
  );
  if (result.rows.length !== 1) {
    throw new Error(
      `Expected exactly one ExposureLimit for ${parameterKey} in ${country} under ${catalogVersion}, found ${result.rows.length}`,
    );
  }
  return result.rows[0];
}

async function getSystemHazard(db, code) {
  const result = await db.query(
    `SELECT id FROM "Hazard" WHERE code = $1 AND "companyId" IS NULL LIMIT 1`,
    [code],
  );
  if (result.rows.length === 0) {
    throw new Error(
      `System hazard ${code} not found — run the M2 migrations/seed first`,
    );
  }
  return result.rows[0].id;
}

// Floor plan image for the site map / heatmap feature. Approach taken:
// generate a plain grey placeholder PNG programmatically (solid background
// + a grid every 100px) rather than requiring a real floor-plan photo to
// exist somewhere on disk — this script has no such asset and shouldn't
// depend on one being manually placed. Uses `pngjs` (pure JS, zero native
// deps, added as a regular dependency alongside pg/@supabase/supabase-js —
// this script already has no qualms pulling in what it needs, same as
// those two) rather than hand-rolling PNG chunk/CRC32/zlib framing, which
// would be a lot of error-prone bytes for a one-off maintenance script.
function buildFloorPlanPng(width, height) {
  const png = new PNG({ width, height });
  const GRID_STEP = 100;
  const BACKGROUND = [224, 224, 224];
  const GRID_LINE = [160, 160, 160];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const onGridLine = x % GRID_STEP < 2 || y % GRID_STEP < 2;
      const [r, g, b] = onGridLine ? GRID_LINE : BACKGROUND;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// The "before" posture sample: a full 33-point MediaPipe landmark array
// (only the 15 indices computeBodyAngles reads are load-bearing — the
// rest are filled with a neutral placeholder, same as this app never
// visualizing a historical sample's skeleton anywhere read-only views
// render). The 15 load-bearing points below were validated offline against
// the real computeBodyAngles (src/lib/pose/angles.ts) — a bent-forward
// fitting posture giving TRUNK ~74° (HIGH, >60°) and NECK ~30° forward
// flexion (HIGH, >25°), the "genuinely poor trunk/neck angles" the plan
// calls for. Re-validate with a throwaway `tsx` script against
// computeBodyAngles if these numbers are ever changed — do not hand-edit
// without doing so, this is exactly the kind of "confident-looking but
// wrong" mistake ERGO_COMPLIANCE_BY_DESIGN.md's MIN_LANDMARK_VISIBILITY
// note warns about.
function buildPoorPostureLandmarks() {
  const placeholder = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  const landmarks = Array.from({ length: 33 }, () => ({ ...placeholder }));

  const set = (index, x, y, visibility = 1) => {
    landmarks[index] = { x, y, z: 0, visibility };
  };
  const bilateral = (leftIndex, rightIndex, x, y) => {
    set(leftIndex, x, y);
    set(rightIndex, x, y);
  };

  set(0, 1.3, 0.62); // NOSE
  bilateral(7, 8, 1.25, 0.7); // EAR
  bilateral(11, 12, 0.85, 0.6); // SHOULDER
  bilateral(13, 14, 0.85, 0.75); // ELBOW
  bilateral(15, 16, 0.85, 0.9); // WRIST
  bilateral(23, 24, 0.5, 0.7); // HIP
  bilateral(25, 26, 0.5, 0.9); // KNEE
  bilateral(27, 28, 0.5, 1.1); // ANKLE

  return landmarks;
}

// Degrees computeBodyAngles produces for buildPoorPostureLandmarks() above
// (SAGITTAL), validated the same way — used only to look up the matching
// ScoringRule row per region, never stored directly (BodyRegionScore
// stores the resulting score/band, not the angle).
const POOR_POSTURE_DEGREES = {
  TRUNK: 74.0546,
  NECK: 29.9816,
  SHOULDER_LEFT: 74.0546,
  SHOULDER_RIGHT: 74.0546,
  ELBOW_LEFT: 0,
  ELBOW_RIGHT: 0,
  KNEE_LEFT: 0,
  KNEE_RIGHT: 0,
};

async function main() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
  );
  const db = new pg.Client({ connectionString: requireEnv("DIRECT_URL") });
  await db.connect();

  try {
    const { row: company, created: companyCreated } = await selectOrInsert(
      db,
      "Company",
      { name: DEMO_COMPANY_NAME },
      {
        id: crypto.randomUUID(),
        name: DEMO_COMPANY_NAME,
        updatedAt: new Date(),
      },
    );
    console.log(
      `${companyCreated ? "Created" : "Reusing"} Company ${company.id}`,
    );

    const { row: site } = await selectOrInsert(
      db,
      "Site",
      { companyId: company.id, name: DEMO_SITE_NAME },
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        name: DEMO_SITE_NAME,
        // Austria, per SLD_IMPLEMENTATION_PLAN_austria-first.md §4.3/§7
        // B1b — the demo company is the Austria-first build's reference
        // deployment, so its address and country now agree.
        address: "14 Riverside Way, Vienna, Austria",
        country: "AT",
        updatedAt: new Date(),
      },
    );
    console.log(`Site: ${site.id}`);

    // --- Org structure: plant -> 4 departments -> 8 workstations -> tasks ---
    const { row: plant } = await selectOrInsert(
      db,
      "OrgUnit",
      { siteId: site.id, name: "Riverside Plant", parentId: null },
      {
        id: crypto.randomUUID(),
        siteId: site.id,
        parentId: null,
        type: "PLANT",
        name: "Riverside Plant",
        updatedAt: new Date(),
      },
    );

    const departmentNames = [
      "Assembly",
      "Welding & Fabrication",
      "Finishing & Coating",
      "Warehousing & Logistics",
    ];
    const departments = {};
    for (const name of departmentNames) {
      const { row } = await selectOrInsert(
        db,
        "OrgUnit",
        { siteId: site.id, name, parentId: plant.id },
        {
          id: crypto.randomUUID(),
          siteId: site.id,
          parentId: plant.id,
          type: "DEPARTMENT",
          name,
          updatedAt: new Date(),
        },
      );
      departments[name] = row;
    }
    console.log(`OrgUnits: 1 plant + ${departmentNames.length} departments`);

    const workstationDefs = [
      {
        name: "Panel Assembly Station 1",
        dept: "Assembly",
        tasks: [
          "Manual panel fitting",
          "Fastener installation",
          "Sub-assembly quality check",
        ],
      },
      {
        name: "Panel Assembly Station 2",
        dept: "Assembly",
        tasks: ["Sub-assembly mounting", "Component alignment"],
      },
      {
        name: "Weld Cell A",
        dept: "Welding & Fabrication",
        tasks: [
          "MIG welding of frame joints",
          "Weld seam inspection",
          "Jig setup",
        ],
      },
      {
        name: "Press Brake Station",
        dept: "Welding & Fabrication",
        tasks: ["Sheet metal bending", "Die changeover"],
      },
      {
        name: "Spray Booth",
        dept: "Finishing & Coating",
        tasks: ["Panel spray coating", "Booth cleaning"],
      },
      {
        name: "Sanding & Finishing Bench",
        dept: "Finishing & Coating",
        tasks: ["Manual sanding", "Surface inspection"],
      },
      {
        name: "Pallet Loading Dock",
        dept: "Warehousing & Logistics",
        tasks: ["Manual pallet loading", "Forklift staging support"],
      },
      {
        name: "Component Racking Area",
        dept: "Warehousing & Logistics",
        tasks: ["Component put-away", "Pick for kitting"],
      },
    ];

    const workstations = {};
    const tasks = {};
    for (const def of workstationDefs) {
      const { row: workstation } = await selectOrInsert(
        db,
        "Workstation",
        { siteId: site.id, name: def.name },
        {
          id: crypto.randomUUID(),
          siteId: site.id,
          orgUnitId: departments[def.dept].id,
          name: def.name,
          updatedAt: new Date(),
        },
      );
      workstations[def.name] = workstation;

      for (const taskName of def.tasks) {
        const { row: task } = await selectOrInsert(
          db,
          "Task",
          { workstationId: workstation.id, name: taskName },
          {
            id: crypto.randomUUID(),
            workstationId: workstation.id,
            name: taskName,
            updatedAt: new Date(),
          },
        );
        tasks[taskName] = task;
      }
    }
    console.log(
      `Workstations: ${workstationDefs.length}, Tasks: ${Object.keys(tasks).length}`,
    );

    // --- Two processes spanning workstations ---
    const { row: assemblyProcess } = await selectOrInsert(
      db,
      "Process",
      { siteId: site.id, name: "Panel Assembly Line" },
      {
        id: crypto.randomUUID(),
        siteId: site.id,
        orgUnitId: departments.Assembly.id,
        name: "Panel Assembly Line",
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    );
    const assemblyLineTasks = [
      "Manual panel fitting",
      "Fastener installation",
      "Sub-assembly mounting",
      "Panel spray coating",
      "Manual sanding",
    ];
    for (const [i, taskName] of assemblyLineTasks.entries()) {
      await selectOrInsert(
        db,
        "ProcessTask",
        { processId: assemblyProcess.id, taskId: tasks[taskName].id },
        {
          id: crypto.randomUUID(),
          processId: assemblyProcess.id,
          taskId: tasks[taskName].id,
          sequence: i + 1,
        },
      );
    }

    const { row: frameProcess } = await selectOrInsert(
      db,
      "Process",
      { siteId: site.id, name: "Frame Fabrication Line" },
      {
        id: crypto.randomUUID(),
        siteId: site.id,
        orgUnitId: departments["Welding & Fabrication"].id,
        name: "Frame Fabrication Line",
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    );
    const frameLineTasks = [
      "Sheet metal bending",
      "MIG welding of frame joints",
      "Weld seam inspection",
      "Component put-away",
    ];
    for (const [i, taskName] of frameLineTasks.entries()) {
      await selectOrInsert(
        db,
        "ProcessTask",
        { processId: frameProcess.id, taskId: tasks[taskName].id },
        {
          id: crypto.randomUUID(),
          processId: frameProcess.id,
          taskId: tasks[taskName].id,
          sequence: i + 1,
        },
      );
    }
    console.log("Processes: Panel Assembly Line, Frame Fabrication Line");

    // --- Floor plan + heatmap positions ---
    // A structural, always-idempotent block like OrgUnit/Workstation/Task
    // above (not gated behind the "historical narrative" flag below) —
    // these rows don't depend on any risk assessment existing, only on the
    // workstations/tasks created above.
    const FLOOR_PLAN_WIDTH = 1200;
    const FLOOR_PLAN_HEIGHT = 800;
    const FLOOR_PLAN_NAME = "Riverside Plant — Ground Floor";
    const FLOOR_PLAN_STORAGE_PATH = `${site.id}/demo-floor-plan.png`;

    const floorPlanPng = buildFloorPlanPng(FLOOR_PLAN_WIDTH, FLOOR_PLAN_HEIGHT);
    const { error: floorPlanUploadError } = await admin.storage
      .from("floor-plans")
      .upload(FLOOR_PLAN_STORAGE_PATH, floorPlanPng, {
        contentType: "image/png",
        upsert: true,
      });
    if (floorPlanUploadError) {
      throw new Error(
        `Failed to upload demo floor plan image (is the "floor-plans" bucket created in the Supabase dashboard? See src/lib/storage/floor-plan.ts): ${floorPlanUploadError.message}`,
      );
    }

    const { row: floorPlan, created: floorPlanCreated } = await selectOrInsert(
      db,
      "FloorPlan",
      { siteId: site.id, name: FLOOR_PLAN_NAME },
      {
        id: crypto.randomUUID(),
        siteId: site.id,
        name: FLOOR_PLAN_NAME,
        storagePath: FLOOR_PLAN_STORAGE_PATH,
        width: FLOOR_PLAN_WIDTH,
        height: FLOOR_PLAN_HEIGHT,
        updatedAt: new Date(),
      },
    );
    console.log(
      `${floorPlanCreated ? "Created" : "Reusing"} FloorPlan ${floorPlan.id}`,
    );

    // Workstation-level pins — spread across the plan, not clustered:
    // - Panel Assembly Station 1 (hero): mixed — 2 of 3 tasks pinned below.
    // - Press Brake Station: no task pins at all — exercises the pure
    //   workstation-level fallback tier, colored via its NOISE finding.
    // - Panel Assembly Station 2: no task pins AND no RiskAssessment
    //   (deliberately left unassessed above) — exercises the grey
    //   "not yet assessed" marker.
    // - Weld Cell A: mixed — 1 of 3 tasks pinned below.
    // Spray Booth deliberately has NO WorkstationPlanPosition: both its
    // tasks are individually pinned below, so the map should render only
    // those two task pins and no workstation-level marker for it at all.
    const workstationPinDefs = [
      { name: "Panel Assembly Station 1", x: 0.15, y: 0.25 },
      { name: "Press Brake Station", x: 0.75, y: 0.2 },
      { name: "Panel Assembly Station 2", x: 0.45, y: 0.15 },
      { name: "Weld Cell A", x: 0.6, y: 0.7 },
    ];
    for (const { name, x, y } of workstationPinDefs) {
      await selectOrInsert(
        db,
        "WorkstationPlanPosition",
        { floorPlanId: floorPlan.id, workstationId: workstations[name].id },
        {
          id: crypto.randomUUID(),
          floorPlanId: floorPlan.id,
          workstationId: workstations[name].id,
          x,
          y,
        },
      );
    }

    // Task-level pins. "Manual panel fitting" and "Fastener installation"
    // (both at the hero workstation) get real PostureSample data below, so
    // their pins render a real color; the other three are deliberately
    // left without a posture sample to also exercise a task pin's own
    // "no data yet" grey state, rather than every task pin being colored.
    const taskPinDefs = [
      { name: "Manual panel fitting", x: 0.12, y: 0.22 },
      { name: "Fastener installation", x: 0.2, y: 0.3 },
      { name: "Panel spray coating", x: 0.3, y: 0.55 },
      { name: "Booth cleaning", x: 0.36, y: 0.6 },
      { name: "Weld seam inspection", x: 0.62, y: 0.68 },
    ];
    for (const { name, x, y } of taskPinDefs) {
      await selectOrInsert(
        db,
        "TaskPlanPosition",
        { floorPlanId: floorPlan.id, taskId: tasks[name].id },
        {
          id: crypto.randomUUID(),
          floorPlanId: floorPlan.id,
          taskId: tasks[name].id,
          x,
          y,
        },
      );
    }
    console.log(
      `Floor plan pins: ${workstationPinDefs.length} workstation-level, ${taskPinDefs.length} task-level`,
    );

    // --- Demo user: company_admin, invite-flow-equivalent (admin-API auth user + PlatformUser) ---
    const { data: existingUsers, error: listError } =
      await admin.auth.admin.listUsers();
    if (listError) throw listError;
    let demoUserId = existingUsers.users.find(
      (u) => u.email === DEMO_EMAIL,
    )?.id;
    if (!demoUserId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      demoUserId = data.user.id;
      console.log(`Created auth user ${demoUserId} (${DEMO_EMAIL})`);
    } else {
      console.log(`Reusing auth user ${demoUserId} (${DEMO_EMAIL})`);
    }
    const existingPlatformUser = await db.query(
      'SELECT id FROM "PlatformUser" WHERE id = $1',
      [demoUserId],
    );
    if (existingPlatformUser.rows.length === 0) {
      await db.query(
        `INSERT INTO "PlatformUser" (id, role, "companyId", name, email, "updatedAt") VALUES ($1, 'COMPANY_ADMIN', $2, $3, $4, now())`,
        [demoUserId, company.id, DEMO_NAME, DEMO_EMAIL],
      );
      console.log(`Created PlatformUser ${demoUserId} (COMPANY_ADMIN)`);
    } else {
      console.log(`Reusing PlatformUser ${demoUserId} (COMPANY_ADMIN)`);
    }

    // --- The historical demo narrative: seeded once, as a block ---
    const heroWorkstation = workstations["Panel Assembly Station 1"];
    const alreadySeeded = await db.query(
      `SELECT id FROM "RiskAssessment" WHERE "workstationId" = $1 AND "pilotContext" = $2 LIMIT 1`,
      [heroWorkstation.id, DEMO_PILOT_CONTEXT],
    );
    if (alreadySeeded.rows.length > 0) {
      console.log(
        "\nDemo history already seeded (found the hero RiskAssessment) — skipping.",
      );
      console.log(
        "Run `npm run reset:demo` first if you want to reseed from scratch.",
      );
    } else {
      const matrixVersion = await getActiveVersion(db, "RiskMatrixVersion");
      const methodologyVersion = await getActiveVersion(
        db,
        "MethodologyVersion",
      );
      const exposureLimitCatalog = await getActiveVersion(
        db,
        "ExposureLimitCatalogVersion",
      );
      const assessedAt = monthsAgo(5);

      async function createApprovedAssessment(workstationName) {
        return insertRow(db, "RiskAssessment", {
          id: crypto.randomUUID(),
          siteId: site.id,
          workstationId: workstations[workstationName].id,
          matrixVersion,
          status: "APPROVED",
          assessorUserId: demoUserId,
          approvedByUserId: demoUserId,
          assessedAt,
          approvedAt: addDays(assessedAt, 3),
          pilotContext: DEMO_PILOT_CONTEXT,
          updatedAt: new Date(),
        });
      }

      async function addFinding(
        assessment,
        hazardCode,
        probability,
        severity,
        existingControls,
      ) {
        const hazardId = await getSystemHazard(db, hazardCode);
        const cell = await getMatrixCell(
          db,
          matrixVersion,
          probability,
          severity,
        );
        return insertRow(db, "RiskFinding", {
          id: crypto.randomUUID(),
          riskAssessmentId: assessment.id,
          hazardId,
          probability,
          severity,
          riskScore: cell.riskScore,
          riskBand: cell.riskBand,
          existingControls: existingControls ?? null,
          updatedAt: new Date(),
        });
      }

      // 1. The hero workstation — ERGONOMIC_MSD at HIGH (the finding the
      // action below is raised against) + a NOISE finding deliberately
      // left without a seeded measurement, so the live demo can add
      // exactly the walkthrough's own example (89 dB(A) LAeq,8h) live and
      // watch it get flagged against Austria's real two-tier VOLV
      // thresholds: over the 80 dB(A) Auslösewert (action value, obliges
      // measures) AND over the 85 dB(A) Expositionsgrenzwert (exposure
      // limit value, must never be exceeded) — a better demo beat than a
      // single EU-directive number, since it shows two thresholds
      // crossing at once (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.4).
      const heroAssessment = await createApprovedAssessment(
        "Panel Assembly Station 1",
      );
      const heroFinding = await addFinding(
        heroAssessment,
        "ERGO-01",
        4,
        4,
        "None — manual lifting and fitting performed at fixed floor-level bench height.",
      );
      await addFinding(
        heroAssessment,
        "NOISE-01",
        3,
        4,
        "Hearing protection available at the station but not consistently worn.",
      );
      console.log(
        `Hero RiskAssessment (Panel Assembly Station 1): ${heroAssessment.id}`,
      );

      // 2. Press Brake Station — NOISE at HIGH, with a real over-limit
      // measurement already on file (contrasts with the hero finding's
      // deliberately-empty one). Pinned to the real seeded AT ExposureLimit
      // catalog row (v1-at-2026, VOLV) via exposureLimitId, same provenance
      // discipline as RiskAssessment.matrixVersion — not the old placeholder
      // EU-directive figure.
      const pressBrakeAssessment = await createApprovedAssessment(
        "Press Brake Station",
      );
      const pressBrakeNoise = await addFinding(
        pressBrakeAssessment,
        "NOISE-01",
        4,
        4,
        "Hearing protection zone signage in place.",
      );
      const pressBrakeNoiseLimit = await getExposureLimit(
        db,
        exposureLimitCatalog,
        "AT",
        "LA_EX_8H",
      );
      await insertRow(db, "ExposureMeasurement", {
        id: crypto.randomUUID(),
        riskFindingId: pressBrakeNoise.id,
        value: 92,
        unit: pressBrakeNoiseLimit.unit,
        actionValue: pressBrakeNoiseLimit.actionValue,
        actionValueReference: pressBrakeNoiseLimit.legalReference,
        limitValue: pressBrakeNoiseLimit.limitValue,
        limitReference: pressBrakeNoiseLimit.legalReference,
        exposureLimitId: pressBrakeNoiseLimit.id,
        instrument: "Class 2 sound level meter",
        method: "Point measurement, 1m from operator ear position",
        measuredAt: assessedAt,
      });
      await addFinding(
        pressBrakeAssessment,
        "MECH-02",
        3,
        3,
        "Interlocked guarding on the press brake's primary nip point.",
      );

      // 3. Spray Booth — CHEMICAL
      const sprayBoothAssessment =
        await createApprovedAssessment("Spray Booth");
      await addFinding(
        sprayBoothAssessment,
        "CHEM-01",
        3,
        4,
        "Extraction fan running; respirator required by site policy.",
      );

      // 4. Sanding & Finishing Bench — DUST_PARTICULATE
      const sandingAssessment = await createApprovedAssessment(
        "Sanding & Finishing Bench",
      );
      await addFinding(
        sandingAssessment,
        "DUST-01",
        3,
        3,
        "Local exhaust ventilation at the bench.",
      );

      // 5. Weld Cell A — RADIATION + CLIMATE_THERMAL
      const weldAssessment = await createApprovedAssessment("Weld Cell A");
      await addFinding(
        weldAssessment,
        "RAD-01",
        3,
        3,
        "Welding curtains and mandatory eye protection.",
      );
      await addFinding(
        weldAssessment,
        "THERM-01",
        2,
        3,
        "Local spot cooling fan.",
      );

      // 6. Pallet Loading Dock — ERGONOMIC_MSD (moderate, distinct from the
      // hero's HIGH) + PSYCHOSOCIAL
      const dockAssessment = await createApprovedAssessment(
        "Pallet Loading Dock",
      );
      await addFinding(
        dockAssessment,
        "ERGO-01",
        3,
        3,
        "Team-lift policy for loads over 20kg.",
      );
      const dockPsychFinding = await addFinding(
        dockAssessment,
        "PSYCH-01",
        2,
        2,
        "Rotating shift schedule, no fixed night-only assignment.",
      );
      // B8f (SLD_NEXT_STEPS_B8b-B8f.md): B7 built PsychosocialFindingDetail
      // but the demo fixture never showed it. GROUP_DISCUSSION at 8 people
      // — below the 15-person floor createPsychosocialFinding's own
      // validatePsychosocialGroupSize only enforces for QUESTIONNAIRE —
      // demonstrates the documented small-group fallback path
      // (ERGO_COMPLIANCE_BY_DESIGN.md §5), not the questionnaire path B5's
      // own live-demo walkthrough already exercises.
      await insertRow(db, "PsychosocialFindingDetail", {
        id: crypto.randomUUID(),
        riskFindingId: dockPsychFinding.id,
        dimension: "WORK_ORGANIZATION",
        method: "GROUP_DISCUSSION",
        groupSize: 8,
        externalProcedureName: null,
      });

      console.log(
        "RiskAssessments seeded for 6 of 8 workstations (Panel Assembly Station 2 and Component Racking Area deliberately left unassessed).",
      );

      // --- The action: raised against the hero finding, IMPLEMENTED but
      // not yet VERIFIED — the live demo capture supplies the "after" and
      // verifies effectiveness against it in real time. ---
      const actionOpenedAt = addDays(assessedAt, 7);
      const actionInProgressAt = addDays(assessedAt, 14);
      const actionImplementedAt = addDays(assessedAt, 60);

      const action = await insertRow(db, "Action", {
        id: crypto.randomUUID(),
        siteId: site.id,
        riskFindingId: heroFinding.id,
        title:
          "Install adjustable-height lift table at Panel Assembly Station 1",
        description:
          "Replace the fixed-height fitting bench with a pneumatic lift table to reduce sustained trunk/neck flexion during manual panel fitting.",
        hierarchyOfControl: "ENGINEERING_CONTROL",
        responsibleUserId: demoUserId,
        dueDate: addDays(assessedAt, 45),
        status: "IMPLEMENTED",
        implementedAt: actionImplementedAt,
        createdAt: actionOpenedAt,
        updatedAt: actionImplementedAt,
      });

      await insertRow(db, "ActionStatusEvent", {
        id: crypto.randomUUID(),
        actionId: action.id,
        fromStatus: "OPEN",
        toStatus: "IN_PROGRESS",
        byUserId: demoUserId,
        note: "Lift table ordered.",
        createdAt: actionInProgressAt,
      });
      await insertRow(db, "ActionStatusEvent", {
        id: crypto.randomUUID(),
        actionId: action.id,
        fromStatus: "IN_PROGRESS",
        toStatus: "IMPLEMENTED",
        byUserId: demoUserId,
        note: "Lift table installed and commissioned.",
        createdAt: actionImplementedAt,
      });
      console.log(
        `Action (IMPLEMENTED, awaiting live verification): ${action.id}`,
      );

      // --- The "before" posture sample: a real, poor-posture capture at
      // the hero workstation, dated alongside the before assessment. No
      // "after" sample is seeded — the live demo capture becomes the after
      // state (see the plan's M7 section). ---
      const sessionStartedAt = addDays(assessedAt, -1);
      const session = await insertRow(db, "AssessmentSession", {
        id: crypto.randomUUID(),
        workstationId: heroWorkstation.id,
        mode: "SCHEDULED",
        pilotContext: DEMO_PILOT_CONTEXT,
        startedAt: sessionStartedAt,
        endedAt: addMinutes(sessionStartedAt, 10),
        notes:
          "Baseline capture — manual panel fitting, before the lift table.",
        updatedAt: new Date(),
      });
      const fittingTask = tasks["Manual panel fitting"];
      await insertRow(db, "AssessmentSessionTask", {
        id: crypto.randomUUID(),
        assessmentSessionId: session.id,
        taskId: fittingTask.id,
      });

      // Shared by both posture samples below — same already-validated
      // landmarks/degrees (see the doc comments above
      // buildPoorPostureLandmarks/POOR_POSTURE_DEGREES), reused rather than
      // hand-crafting a second angle set: the site map heatmap only needs
      // a second real (non-null) colored task pin to demonstrate against,
      // not a different band value, and CLAUDE.md is explicit that any new
      // hand-edited keypoints must be re-validated offline against
      // computeBodyAngles before use — reusing the proven set sidesteps
      // that entirely.
      async function createPoorPostureSample(task, capturedAt) {
        const keypoints = buildPoorPostureLandmarks();
        const postureSample = await insertRow(db, "PostureSample", {
          id: crypto.randomUUID(),
          taskId: task.id,
          capturedAt,
          cameraAngle: "SAGITTAL",
          // Real MediaPipe-shaped keypoints, so this is a camera-sourced
          // sample (SLD_IMPLEMENTATION_PLAN_austria-first.md §5/§7 B2) —
          // required now that "source" is NOT NULL with no column
          // default.
          source: "CAMERA_MEDIAPIPE",
          keypoints: JSON.stringify(keypoints),
          // Also fixes a latent gap from before "source" existed: this
          // column has been NOT NULL with no default since
          // 20260810120100_add_posture_sample_validation, so this insert
          // was already missing a required value. PENDING_REVIEW, not
          // VALIDATED — there's no real reviewer/validatedAt/
          // validatedKeypoints to backfill for scripted seed data, and
          // claiming VALIDATED without them would violate
          // PostureSample_validation_completeness_check.
          validationStatus: "PENDING_REVIEW",
        });
        for (const [bodyRegion, degrees] of Object.entries(
          POOR_POSTURE_DEGREES,
        )) {
          const rule = await getScoringRule(
            db,
            methodologyVersion,
            bodyRegion,
            degrees,
          );
          await insertRow(db, "BodyRegionScore", {
            id: crypto.randomUUID(),
            postureSampleId: postureSample.id,
            bodyRegion,
            score: rule.riskScore,
            scoringRuleVersion: rule.methodologyVersion,
          });
        }
        return postureSample;
      }

      await createPoorPostureSample(
        fittingTask,
        addMinutes(sessionStartedAt, 2),
      );

      // Second sample, at the hero workstation's other individually-pinned
      // task, purely so the site map heatmap has more than one real
      // (non-null) colored task pin to show — not part of the original M7
      // demo narrative otherwise.
      await createPoorPostureSample(
        tasks["Fastener installation"],
        addMinutes(sessionStartedAt, 6),
      );

      // Third sample, at the hero workstation's remaining (deliberately
      // un-pinned) task. This one isn't a task pin itself, but the site
      // map's workstation-level "mixed" marker (some tasks pinned, some
      // not) derives its color from the *unplaced* tasks' ergonomic band
      // specifically — never from the RiskAssessment, to avoid the map
      // double-counting a task's risk both as its own pin and folded back
      // into the workstation aggregate (see site-map-client.tsx). Without
      // this sample, that unplaced-task band would be null (no data) and
      // the hero workstation's own marker would render grey despite the
      // workstation otherwise having a real HIGH-band assessment — giving
      // it real data here means the map has at least one colored "mixed"
      // marker to demonstrate that tier, not just the colored "full"
      // marker (Press Brake Station) and grey ones (Panel Assembly
      // Station 2's "not yet assessed", Weld Cell A's "no ergonomic data
      // among its unplaced tasks").
      await createPoorPostureSample(
        tasks["Sub-assembly quality check"],
        addMinutes(sessionStartedAt, 10),
      );

      console.log(
        `"Before" AssessmentSession + PostureSamples seeded for "Manual panel fitting", "Fastener installation", and "Sub-assembly quality check" (TRUNK ${POOR_POSTURE_DEGREES.TRUNK.toFixed(1)}°, NECK ${POOR_POSTURE_DEGREES.NECK.toFixed(1)}° — both HIGH).`,
      );

      // --- Repetition count (B8d, SLD_NEXT_STEPS_B8b-B8f.md) — B8d built
      // the sub-score but the demo fixture never showed it. 450 reps/cycle
      // on the hero task lands in the seeded RepetitionRule HIGH band
      // ([120,∞)), the same "posture + repetition both scoring HIGH"
      // completeness beat B8d's own verification pass used. ---
      await insertRow(db, "ManualInput", {
        id: crypto.randomUUID(),
        taskId: fittingTask.id,
        inputType: "REPETITION_COUNT",
        value: 450,
        unit: "reps",
        textValue: null,
        notes: null,
        createdAt: sessionStartedAt,
      });
      console.log(
        `REPETITION_COUNT ManualInput seeded for "Manual panel fitting" (450 reps/cycle — HIGH).`,
      );
    }

    console.log("\nDemo fixture ready:");
    console.log(
      JSON.stringify(
        {
          companyId: company.id,
          companyName: DEMO_COMPANY_NAME,
          siteId: site.id,
          heroWorkstationId: heroWorkstation.id,
          heroWorkstationName: "Panel Assembly Station 1",
          heroTaskName: "Manual panel fitting",
          demoUser: {
            platformUserId: demoUserId,
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
