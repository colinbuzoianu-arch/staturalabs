// Provision (or update) a SUPER_ADMIN platform account.
//
//   node scripts/provision-super-admin.mjs <email> <password> ["Full Name"]
//
// Creates the Supabase auth user (email pre-confirmed) if it doesn't exist, or
// resets its password if it does, then upserts the matching PlatformUser row
// as SUPER_ADMIN (companyId null, per the PlatformUser CHECK constraint). The
// PlatformUser.id must equal the auth user id — that's the link
// getCurrentPlatformUser resolves on sign-in — so a stale row carrying this
// email under a different id is cleared first.
//
// Accounts are normally invite-only; this is a deliberate ops escape hatch for
// seeding the founder's own super-admin, run by hand, never from app code.
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import pg from "pg";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error(
    'Usage: node scripts/provision-super-admin.mjs <email> <password> ["Full Name"]',
  );
  process.exit(1);
}
const displayName = name || email.split("@")[0];

async function main() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
  );
  const db = new pg.Client({ connectionString: requireEnv("DIRECT_URL") });
  await db.connect();

  try {
    // Find the auth user by email (paginated listing, same as the seed).
    let authId = null;
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw error;
      const found = data.users.find((u) => u.email === email);
      if (found) {
        authId = found.id;
        break;
      }
      if (data.users.length < 200) break;
      page += 1;
    }

    if (authId) {
      const { error } = await admin.auth.admin.updateUserById(authId, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
      console.log(`Updated existing auth user ${authId} (${email})`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      authId = data.user.id;
      console.log(`Created auth user ${authId} (${email})`);
    }

    const byId = await db.query('SELECT id FROM "PlatformUser" WHERE id = $1', [
      authId,
    ]);
    if (byId.rows.length > 0) {
      await db.query(
        `UPDATE "PlatformUser"
           SET role = 'SUPER_ADMIN', "companyId" = NULL, name = $2, email = $3, "updatedAt" = now()
         WHERE id = $1`,
        [authId, displayName, email],
      );
      console.log(`Updated PlatformUser ${authId} -> SUPER_ADMIN`);
    } else {
      // Clear any stale row that carries this email under a different id.
      const stale = await db.query(
        'DELETE FROM "PlatformUser" WHERE email = $1 AND id <> $2 RETURNING id',
        [email, authId],
      );
      if (stale.rows.length > 0) {
        console.log(
          `Removed ${stale.rows.length} stale PlatformUser row(s) for ${email}`,
        );
      }
      await db.query(
        `INSERT INTO "PlatformUser" (id, role, "companyId", name, email, "updatedAt")
         VALUES ($1, 'SUPER_ADMIN', NULL, $2, $3, now())`,
        [authId, displayName, email],
      );
      console.log(`Created PlatformUser ${authId} -> SUPER_ADMIN`);
    }

    console.log(`\nSuper-admin ready: ${email} (id ${authId})`);
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
