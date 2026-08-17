// Minimal dev fixture: Company -> two Sites -> Workstation -> Task, plus
// three PlatformUsers backed by real Supabase auth users — someone to
// actually authenticate as when exercising the API by hand or in a smoke
// test:
//  - SITE_ADMIN, assigned (via SiteAssignment) to only the first site —
//    for testing single-site scoping.
//  - COMPANY_ADMIN on the same company, no SiteAssignment (doesn't need
//    one — company_admin's site access is implicit via companyId) — for
//    testing whole-company/multi-site scoping (canAccessSite's
//    COMPANY_ADMIN branch, the dashboard landing view listing >1 site).
//  - SUPER_ADMIN, companyId null (per the PlatformUser CHECK constraint —
//    company-scoped roles require one, platform-level roles must not have
//    one) — for testing /admin, which has no other fixture coverage
//    otherwise.
//
// Not the app's invite flow (src/lib/auth/invite.ts) — this creates the
// auth user directly via the admin API with a known password, which is
// fine for a dev fixture but is NOT how production accounts get created
// (invite-only, no password set until the invite is accepted).
//
// Idempotent: re-running reuses the existing auth user and rows (matched by
// email / by name within their parent) instead of creating duplicates.
//
// Usage: npm run seed:dev
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import pg from "pg";

const DEV_EMAIL = "dev-site-admin@statura.local";
const DEV_PASSWORD = "Dev-Fixture-Passw0rd!";
const DEV_COMPANY_ADMIN_EMAIL = "dev-company-admin@statura.local";
const DEV_COMPANY_ADMIN_PASSWORD = "Dev-Fixture-Passw0rd!";
const DEV_SUPER_ADMIN_EMAIL = "dev-super-admin@statura.local";
const DEV_SUPER_ADMIN_PASSWORD = "Dev-Fixture-Passw0rd!";
const COMPANY_NAME = "Dev Fixture Co";
const SITE_NAME = "Dev Fixture Site";
const SITE_2_NAME = "Dev Fixture Site 2";
const WORKSTATION_NAME = "Dev Fixture Workstation";
const TASK_NAME = "Dev Fixture Task";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Ids here are UUIDs (crypto.randomUUID()), not Prisma's cuid() format —
// fine, since these columns are unconstrained TEXT and nothing depends on
// the id format, only its uniqueness.
async function selectOrInsert(db, table, whereCols, insertCols) {
  const whereClause = Object.keys(whereCols)
    .map((k, i) => `"${k}" = $${i + 1}`)
    .join(" AND ");
  const existing = await db.query(
    `SELECT * FROM "${table}" WHERE ${whereClause} LIMIT 1`,
    Object.values(whereCols),
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
      { name: COMPANY_NAME },
      { id: crypto.randomUUID(), name: COMPANY_NAME, updatedAt: new Date() },
    );
    console.log(
      `${companyCreated ? "Created" : "Reusing"} Company ${company.id}`,
    );

    const { row: site, created: siteCreated } = await selectOrInsert(
      db,
      "Site",
      { companyId: company.id, name: SITE_NAME },
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        name: SITE_NAME,
        // Dev fixture's home jurisdiction, per
        // SLD_IMPLEMENTATION_PLAN_austria-first.md §4.3/§7 B1b.
        country: "RO",
        updatedAt: new Date(),
      },
    );
    console.log(`${siteCreated ? "Created" : "Reusing"} Site ${site.id}`);

    const { row: site2, created: site2Created } = await selectOrInsert(
      db,
      "Site",
      { companyId: company.id, name: SITE_2_NAME },
      {
        id: crypto.randomUUID(),
        companyId: company.id,
        name: SITE_2_NAME,
        country: "RO",
        updatedAt: new Date(),
      },
    );
    console.log(`${site2Created ? "Created" : "Reusing"} Site ${site2.id}`);

    const { row: workstation, created: workstationCreated } =
      await selectOrInsert(
        db,
        "Workstation",
        { siteId: site.id, name: WORKSTATION_NAME },
        {
          id: crypto.randomUUID(),
          siteId: site.id,
          name: WORKSTATION_NAME,
          updatedAt: new Date(),
        },
      );
    console.log(
      `${workstationCreated ? "Created" : "Reusing"} Workstation ${workstation.id}`,
    );

    const { row: task, created: taskCreated } = await selectOrInsert(
      db,
      "Task",
      { workstationId: workstation.id, name: TASK_NAME },
      {
        id: crypto.randomUUID(),
        workstationId: workstation.id,
        name: TASK_NAME,
        updatedAt: new Date(),
      },
    );
    console.log(`${taskCreated ? "Created" : "Reusing"} Task ${task.id}`);

    async function ensureAuthUser(email, password) {
      const { data: existingUsers, error: listError } =
        await admin.auth.admin.listUsers();
      if (listError) throw listError;
      const existingUser = existingUsers.users.find((u) => u.email === email);
      if (existingUser) {
        console.log(`Reusing auth user ${existingUser.id} (${email})`);
        return existingUser.id;
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      console.log(`Created auth user ${data.user.id} (${email})`);
      return data.user.id;
    }

    async function ensurePlatformUser(userId, role, name, email, companyId) {
      const existing = await db.query(
        'SELECT id FROM "PlatformUser" WHERE id = $1',
        [userId],
      );
      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO "PlatformUser" (id, role, "companyId", name, email, "updatedAt") VALUES ($1, $2, $3, $4, $5, now())`,
          [userId, role, companyId, name, email],
        );
        console.log(`Created PlatformUser ${userId} (${role})`);
      } else {
        console.log(`Reusing PlatformUser ${userId} (${role})`);
      }
    }

    async function ensureSiteAssignment(userId, siteId) {
      const existing = await db.query(
        'SELECT id FROM "SiteAssignment" WHERE "userId" = $1 AND "siteId" = $2',
        [userId, siteId],
      );
      if (existing.rows.length === 0) {
        await db.query(
          'INSERT INTO "SiteAssignment" (id, "userId", "siteId") VALUES ($1, $2, $3)',
          [crypto.randomUUID(), userId, siteId],
        );
        console.log(`Created SiteAssignment (${userId} -> ${siteId})`);
      } else {
        console.log(`Reusing SiteAssignment (${userId} -> ${siteId})`);
      }
    }

    // site_admin: scoped only to `site` (not site2) via SiteAssignment.
    const userId = await ensureAuthUser(DEV_EMAIL, DEV_PASSWORD);
    await ensurePlatformUser(
      userId,
      "SITE_ADMIN",
      "Dev Site Admin",
      DEV_EMAIL,
      company.id,
    );
    await ensureSiteAssignment(userId, site.id);

    // company_admin: no SiteAssignment row at all — companyId alone grants
    // access to every site under it (canAccessSite's COMPANY_ADMIN branch),
    // including site2, which the site_admin above can't see.
    const companyAdminUserId = await ensureAuthUser(
      DEV_COMPANY_ADMIN_EMAIL,
      DEV_COMPANY_ADMIN_PASSWORD,
    );
    await ensurePlatformUser(
      companyAdminUserId,
      "COMPANY_ADMIN",
      "Dev Company Admin",
      DEV_COMPANY_ADMIN_EMAIL,
      company.id,
    );

    // super_admin: companyId null, cross-company by role alone — the CHECK
    // constraint on PlatformUser requires this (company-scoped roles need a
    // companyId, platform-level roles must not have one).
    const superAdminUserId = await ensureAuthUser(
      DEV_SUPER_ADMIN_EMAIL,
      DEV_SUPER_ADMIN_PASSWORD,
    );
    await ensurePlatformUser(
      superAdminUserId,
      "SUPER_ADMIN",
      "Dev Super Admin",
      DEV_SUPER_ADMIN_EMAIL,
      null,
    );

    console.log("\nFixture ready:");
    console.log(
      JSON.stringify(
        {
          companyId: company.id,
          siteId: site.id,
          site2Id: site2.id,
          workstationId: workstation.id,
          taskId: task.id,
          siteAdmin: {
            platformUserId: userId,
            email: DEV_EMAIL,
            password: DEV_PASSWORD,
          },
          companyAdmin: {
            platformUserId: companyAdminUserId,
            email: DEV_COMPANY_ADMIN_EMAIL,
            password: DEV_COMPANY_ADMIN_PASSWORD,
          },
          superAdmin: {
            platformUserId: superAdminUserId,
            email: DEV_SUPER_ADMIN_EMAIL,
            password: DEV_SUPER_ADMIN_PASSWORD,
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
