// P18 B.1: regenerate the handbook's screenshots in one command.
//
// Signs into the DEMO tenant as each role (de-AT wording, light theme, fixed
// viewport) and captures the routes listed in the manifest below, overwriting
// docs/handbuch/img/**. After a UI change the founder runs this once instead
// of re-taking screenshots by hand.
//
// Playwright is NOT a project dependency: it is a ~300 MB browser download
// that only this script and the optional video recording need, so it is
// installed on demand and the script says so rather than failing cryptically:
//
//   npm i -D playwright && npx playwright install chromium
//   npm run docs:screenshots
//
// Needs a dev server (npm run dev) and a seeded demo tenant (npm run seed:demo).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = join(process.cwd(), "docs", "handbuch", "img");
const VIEWPORT = { width: 1440, height: 900 };

// The demo users seeded by P17 slice 7. One password for all of them (the demo
// tenant's published one).
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";
const USERS = {
  admin: "demo-admin@statura.local",
  siteAdmin: "demo-standortadmin@statura.local",
  ehs: "demo-ehsfachkraft@statura.local",
  leader: "demo-fuehrungskraft@statura.local",
  employee: "demo-mitarbeiter@statura.local",
};

// The manifest: one entry per screenshot the handbook references. `path` takes
// {siteId}, resolved from the demo tenant at run time.
const SHOTS = [
  { file: "sidebar.png", as: "admin", path: "/app/s/{siteId}" },
  { file: "my-tasks.png", as: "ehs", path: "/app/me" },
  { file: "calendar.png", as: "ehs", path: "/app/s/{siteId}/calendar" },
  {
    file: "risk-workstations.png",
    as: "ehs",
    path: "/app/s/{siteId}/risk/workstations",
  },
  {
    file: "risk-assessment.png",
    as: "ehs",
    path: "/app/s/{siteId}/risk/assessments",
  },
  {
    file: "inspections.png",
    as: "ehs",
    path: "/app/s/{siteId}/inspections/planned",
  },
  {
    file: "incidents.png",
    as: "ehs",
    path: "/app/s/{siteId}/incidents/reports",
  },
  { file: "environment.png", as: "ehs", path: "/app/s/{siteId}/environment" },
  { file: "actions.png", as: "ehs", path: "/app/s/{siteId}/actions" },
  {
    file: "chemicals-register.png",
    as: "ehs",
    path: "/app/s/{siteId}/chemicals/register",
  },
  {
    file: "training-matrix.png",
    as: "leader",
    path: "/app/s/{siteId}/training/matrix",
  },
  {
    file: "training-sessions.png",
    as: "leader",
    path: "/app/s/{siteId}/training/sessions",
  },
  { file: "people.png", as: "siteAdmin", path: "/app/s/{siteId}/people" },
  {
    file: "legal-register.png",
    as: "ehs",
    path: "/app/s/{siteId}/legal/register",
  },
  {
    file: "documents.png",
    as: "ehs",
    path: "/app/s/{siteId}/documents/library",
  },
  {
    file: "reports-kpis.png",
    as: "admin",
    path: "/app/s/{siteId}/reports/kpis",
  },
  {
    file: "broadcasts-sent.png",
    as: "siteAdmin",
    path: "/app/s/{siteId}/broadcasts/sent",
  },
  {
    file: "employee-instructions.png",
    as: "employee",
    path: "/app/me/instructions",
  },
  {
    file: "settings-users.png",
    as: "admin",
    path: "/app/s/{siteId}/settings/users",
  },
  { file: "help.png", as: "admin", path: "/app/s/{siteId}/help" },
];

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "Playwright is not installed (it is intentionally not a project dependency).\n" +
        "  npm i -D playwright && npx playwright install chromium\n" +
        "then re-run `npm run docs:screenshots`.",
    );
    process.exit(1);
  }

  // The demo site id, read straight from the database the dev server uses.
  const pg = await import("pg");
  const { readFileSync } = await import("node:fs");
  const env = readFileSync(".env", "utf8");
  const url = /^DIRECT_URL="?([^"\n]+)/m.exec(env)?.[1];
  if (!url) throw new Error("DIRECT_URL not found in .env");
  const db = new pg.default.Client({ connectionString: url });
  await db.connect();
  const site = (
    await db.query(
      `SELECT s.id FROM "Site" s JOIN "Company" c ON c.id = s."companyId"
        WHERE c."tenantKind" = 'DEMO' AND s.country = 'AT' LIMIT 1`,
    )
  ).rows[0];
  await db.end();
  if (!site)
    throw new Error("No AT site in the DEMO tenant — run npm run seed:demo");

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const written = [];

  try {
    // One browser context per role, so a sign-in is reused across that role's
    // shots instead of signing in twenty times.
    for (const [role, email] of Object.entries(USERS)) {
      const shots = SHOTS.filter((s) => s.as === role);
      if (shots.length === 0) continue;
      const context = await browser.newContext({
        viewport: VIEWPORT,
        locale: "de-AT",
        colorScheme: "light",
      });
      const page = await context.newPage();

      await page.goto(`${BASE}/login`);
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/app/, { timeout: 30_000 });
      // The handbook is German: set the locale cookie the app reads.
      await context.addCookies([
        {
          name: "statura-locale",
          value: "de",
          url: BASE,
        },
      ]);

      for (const shot of shots) {
        const target = `${BASE}${shot.path.replace("{siteId}", site.id)}`;
        await page.goto(target, { waitUntil: "networkidle" });
        await page.screenshot({ path: join(OUT_DIR, shot.file) });
        written.push(shot.file);
        console.log(`  ${shot.file} ← ${shot.path}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(
    join(OUT_DIR, "MANIFEST.txt"),
    `${written.join("\n")}\n`,
    "utf8",
  );
  console.log(`\n${written.length} screenshot(s) → docs/handbuch/img/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
