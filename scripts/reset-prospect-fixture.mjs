// P16 §5: reset the prospect demo pack — remove exactly the seed:prospect
// additions (products marked by the fictional supplier, their SDS/composition/BA/
// uses, the prospect storage locations) and set the tenant's engines back to OFF,
// so the tenant returns to its clean pre-prospect state. Leaf-to-root deletion
// (all FKs Restrict). REFUSES unless the demo/prospect company is found (marker
// guard, like reset:demo). Run: npm run reset:prospect
import { readFileSync } from "node:fs";
import pg from "pg";
import {
  PROSPECT_COMPANY_NAME,
  PROSPECT_STORAGE_PREFIX,
  PROSPECT_SUPPLIER,
} from "./prospect-fixture-constants.mjs";

function requireEnv(k) {
  const env = readFileSync(".env", "utf8");
  const m = env.match(new RegExp(`^${k}="?([^"\\n]+)`, "m"));
  if (!m) throw new Error(`Missing ${k}`);
  return m[1];
}

async function main() {
  const db = new pg.Client({ connectionString: requireEnv("DIRECT_URL") });
  await db.connect();
  try {
    const co = await db.query(
      `SELECT id FROM "Company" WHERE name = $1 LIMIT 1`,
      [PROSPECT_COMPANY_NAME],
    );
    if (!co.rows.length) {
      console.log(
        `Refusing to reset: prospect/demo company not found (${PROSPECT_COMPANY_NAME}). Nothing to reset.`,
      );
      return;
    }
    const companyId = co.rows[0].id;

    const subs = await db.query(
      `SELECT id FROM "Substance" WHERE "companyId"=$1 AND manufacturer=$2`,
      [companyId, PROSPECT_SUPPLIER],
    );
    const ids = subs.rows.map((r) => r.id);
    if (ids.length) {
      const sheets = await db.query(
        `SELECT id FROM "SafetyDataSheet" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      const sheetIds = sheets.rows.map((r) => r.id);
      await db.query(
        `DELETE FROM "OperatingInstruction" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      await db.query(
        `DELETE FROM "MixtureComponent" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      if (sheetIds.length)
        await db.query(
          `DELETE FROM "SdsComponent" WHERE "safetyDataSheetId" = ANY($1)`,
          [sheetIds],
        );
      await db.query(
        `DELETE FROM "SafetyDataSheet" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      await db.query(
        `DELETE FROM "SubstanceStatement" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      await db.query(
        `DELETE FROM "SubstancePictogram" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      await db.query(
        `DELETE FROM "FindingSubstance" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      await db.query(
        `DELETE FROM "SubstanceUse" WHERE "substanceId" = ANY($1)`,
        [ids],
      );
      await db.query(`DELETE FROM "Substance" WHERE id = ANY($1)`, [ids]);
    }

    // Prospect storage locations (only after their uses are gone above).
    await db.query(
      `DELETE FROM "StorageLocation" WHERE name LIKE $1 AND "siteId" IN (SELECT id FROM "Site" WHERE "companyId"=$2)
       AND NOT EXISTS (SELECT 1 FROM "SubstanceUse" u WHERE u."storageLocationId" = "StorageLocation".id)`,
      [`${PROSPECT_STORAGE_PREFIX} %`, companyId],
    );

    // Engines back to OFF (remove explicit PREVIEW settings → default OFF).
    await db.query(`DELETE FROM "EngineFlagSetting" WHERE "companyId"=$1`, [
      companyId,
    ]);
    // Clear archived preview SDS drafts for the tenant.
    await db.query(
      `DELETE FROM "GeneratedDocument" WHERE "companyId"=$1 AND type='SDS_DRAFT_PREVIEW'`,
      [companyId],
    );

    console.log(
      `reset:prospect done — removed ${ids.length} prospect products + storage, engines OFF, on ${PROSPECT_COMPANY_NAME}`,
    );
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
