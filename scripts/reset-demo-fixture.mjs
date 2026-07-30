// Wipes the demo account's data so it can be re-seeded cleanly before the
// next walkthrough (SLD_IMPLEMENTATION_PLAN_demo-loop.md M7, "fixture
// hygiene"). Hard deletion is otherwise a deliberate, logged action per
// ERGO_COMPLIANCE_BY_DESIGN.md §3.9 — never a casual one — so this script
// exists specifically to be that deliberate, logged action, scoped as
// tightly as possible:
//
//   - REFUSES to run against any company whose name doesn't start with
//     the exact "DEMO — " marker seed-demo-fixture.mjs uses. A reset
//     script that can be pointed at a real tenant is a data-loss incident
//     waiting to happen — this is the one thing this script must never
//     get wrong.
//   - Logs every table and row count it removes.
//   - Deletes in dependency order (children before parents) by hand,
//     since every FK in this schema is ON DELETE RESTRICT, not CASCADE
//     (§3.9 again) — there is no shortcut "delete the Company and let the
//     database cascade" available, by design.
//   - Leaves the demo Supabase auth account itself alone: the next
//     `npm run seed:demo` reuses it by email (same as seed-dev-fixture.mjs
//     does for its fixture users), so there is nothing to clean up there.
//
// Usage: npm run reset:demo
import "dotenv/config";
import pg from "pg";
import { DEMO_COMPANY_NAME } from "./demo-fixture-constants.mjs";

const DEMO_MARKER = "DEMO — ";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function del(db, label, sql, params) {
  const result = await db.query(sql, params);
  console.log(`  ${label}: ${result.rowCount} row(s)`);
  return result.rowCount;
}

async function main() {
  const db = new pg.Client({ connectionString: requireEnv("DIRECT_URL") });
  await db.connect();

  try {
    const companyResult = await db.query(
      `SELECT id, name FROM "Company" WHERE name = $1`,
      [DEMO_COMPANY_NAME],
    );
    if (companyResult.rows.length === 0) {
      console.log(
        `No company named "${DEMO_COMPANY_NAME}" found — nothing to reset.`,
      );
      return;
    }
    const company = companyResult.rows[0];

    // The actual safety gate. Re-checked against the row just fetched by
    // exact name (not the constant used to find it) so this can't be
    // bypassed by ever calling the delete helpers below with a different
    // company — everything from here on is scoped to `company.id`, which
    // has now been proven to carry the marker.
    if (!company.name.startsWith(DEMO_MARKER)) {
      throw new Error(
        `Refusing to reset: company "${company.name}" does not start with "${DEMO_MARKER}". ` +
          `This script only ever touches companies clearly marked as demo data.`,
      );
    }

    console.log(`Resetting demo company "${company.name}" (${company.id})\n`);

    const siteIds = (
      await db.query(`SELECT id FROM "Site" WHERE "companyId" = $1`, [
        company.id,
      ])
    ).rows.map((r) => r.id);

    if (siteIds.length === 0) {
      console.log(
        "No sites under this company — deleting the company row only.",
      );
      await del(db, "Company", `DELETE FROM "Company" WHERE id = $1`, [
        company.id,
      ]);
      return;
    }

    console.log(`Sites: ${siteIds.join(", ")}\n`);

    await del(
      db,
      "ActionStatusEvent",
      `DELETE FROM "ActionStatusEvent" WHERE "actionId" IN (SELECT id FROM "Action" WHERE "siteId" = ANY($1))`,
      [siteIds],
    );
    await del(db, "Action", `DELETE FROM "Action" WHERE "siteId" = ANY($1)`, [
      siteIds,
    ]);
    await del(
      db,
      "ExposureMeasurement",
      `DELETE FROM "ExposureMeasurement" WHERE "riskFindingId" IN (
         SELECT rf.id FROM "RiskFinding" rf
         JOIN "RiskAssessment" ra ON ra.id = rf."riskAssessmentId"
         WHERE ra."siteId" = ANY($1)
       )`,
      [siteIds],
    );
    await del(
      db,
      "RiskFinding",
      `DELETE FROM "RiskFinding" WHERE "riskAssessmentId" IN (SELECT id FROM "RiskAssessment" WHERE "siteId" = ANY($1))`,
      [siteIds],
    );
    await del(
      db,
      "RiskAssessment",
      `DELETE FROM "RiskAssessment" WHERE "siteId" = ANY($1)`,
      [siteIds],
    );
    await del(
      db,
      "ProcessTask",
      `DELETE FROM "ProcessTask" WHERE "processId" IN (SELECT id FROM "Process" WHERE "siteId" = ANY($1))`,
      [siteIds],
    );
    await del(db, "Process", `DELETE FROM "Process" WHERE "siteId" = ANY($1)`, [
      siteIds,
    ]);
    await del(
      db,
      "BodyRegionScore",
      `DELETE FROM "BodyRegionScore" WHERE "postureSampleId" IN (
         SELECT ps.id FROM "PostureSample" ps
         JOIN "Task" t ON t.id = ps."taskId"
         JOIN "Workstation" w ON w.id = t."workstationId"
         WHERE w."siteId" = ANY($1)
       )`,
      [siteIds],
    );
    await del(
      db,
      "PostureSample",
      `DELETE FROM "PostureSample" WHERE "taskId" IN (
         SELECT t.id FROM "Task" t JOIN "Workstation" w ON w.id = t."workstationId" WHERE w."siteId" = ANY($1)
       )`,
      [siteIds],
    );
    await del(
      db,
      "ManualInput",
      `DELETE FROM "ManualInput" WHERE "taskId" IN (
         SELECT t.id FROM "Task" t JOIN "Workstation" w ON w.id = t."workstationId" WHERE w."siteId" = ANY($1)
       )`,
      [siteIds],
    );
    await del(
      db,
      "AssessmentSessionTask",
      `DELETE FROM "AssessmentSessionTask" WHERE "assessmentSessionId" IN (
         SELECT id FROM "AssessmentSession" WHERE "workstationId" IN (SELECT id FROM "Workstation" WHERE "siteId" = ANY($1))
       )`,
      [siteIds],
    );
    await del(
      db,
      "AssessmentSession",
      `DELETE FROM "AssessmentSession" WHERE "workstationId" IN (SELECT id FROM "Workstation" WHERE "siteId" = ANY($1))`,
      [siteIds],
    );
    await del(
      db,
      "Task",
      `DELETE FROM "Task" WHERE "workstationId" IN (SELECT id FROM "Workstation" WHERE "siteId" = ANY($1))`,
      [siteIds],
    );
    await del(
      db,
      "Workstation",
      `DELETE FROM "Workstation" WHERE "siteId" = ANY($1)`,
      [siteIds],
    );

    // OrgUnit is a self-referencing tree (parentId ON DELETE RESTRICT) —
    // children must go before parents. The tree here is at most 2 levels
    // deep (plant -> department), but this walks depth generically rather
    // than assuming that, in case the org structure ever grows a level.
    let remaining = (
      await db.query(
        `SELECT id, "parentId" FROM "OrgUnit" WHERE "siteId" = ANY($1)`,
        [siteIds],
      )
    ).rows;
    let orgUnitsDeleted = 0;
    while (remaining.length > 0) {
      const remainingIds = new Set(remaining.map((r) => r.id));
      // Leaves: no other remaining OrgUnit has this row as its parent.
      const leafIds = remaining
        .filter((r) => !remaining.some((other) => other.parentId === r.id))
        .map((r) => r.id);
      if (leafIds.length === 0) {
        throw new Error(
          "OrgUnit deletion made no progress — possible cycle in the tree.",
        );
      }
      const result = await db.query(
        `DELETE FROM "OrgUnit" WHERE id = ANY($1)`,
        [leafIds],
      );
      orgUnitsDeleted += result.rowCount;
      remaining = remaining.filter(
        (r) => !leafIds.includes(r.id) && remainingIds.has(r.id),
      );
    }
    console.log(`  OrgUnit: ${orgUnitsDeleted} row(s)`);

    await del(
      db,
      "Hazard (company additions)",
      `DELETE FROM "Hazard" WHERE "companyId" = $1`,
      [company.id],
    );
    await del(
      db,
      "SiteAssignment",
      `DELETE FROM "SiteAssignment" WHERE "siteId" = ANY($1)`,
      [siteIds],
    );
    await del(db, "Site", `DELETE FROM "Site" WHERE "companyId" = $1`, [
      company.id,
    ]);
    await del(
      db,
      "PlatformUser",
      `DELETE FROM "PlatformUser" WHERE "companyId" = $1`,
      [company.id],
    );
    await del(db, "Company", `DELETE FROM "Company" WHERE id = $1`, [
      company.id,
    ]);

    console.log("\nDemo company reset complete.");
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
