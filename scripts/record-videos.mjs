// P18 Part C (optional): record silent raw footage for the ten video scripts.
//
// Walks the NAVIGATION path of each script in docs/videos/DE_SKRIPTE.md inside
// the DEMO tenant and saves one 1080p video per script to docs/videos/raw/.
// The founder adds the voice-over, or uses the clips as a rehearsal.
//
// Deliberately read-only: the steps in the scripts that WRITE (create a
// finding, close an action, issue an access code) are not automated, because
// they would change the demo tenant mid-recording and make the next run look
// different. Those parts the founder records live, after a reset.
//
// Playwright is NOT a project dependency: it is a ~300 MB browser download
// that only this script and the screenshots need, so it is installed on demand
// and this script says so rather than failing cryptically:
//
//   npm i -D playwright && npx playwright install chromium
//   npm run docs:videos
//
// Needs a dev server (npm run dev) and a seeded demo tenant (npm run seed:demo).
import { mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = join(process.cwd(), "docs", "videos", "raw");
const VIEWPORT = { width: 1920, height: 1080 };
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";

// The demo users seeded by P17 slice 7, named as in DE_SKRIPTE.md.
const USERS = {
  ADMIN: "demo-admin@statura.local",
  STANDORT: "demo-standortadmin@statura.local",
  EHS: "demo-ehsfachkraft@statura.local",
  FUEHRUNG: "demo-fuehrungskraft@statura.local",
  MITARBEIT: "demo-mitarbeiter@statura.local",
};

// One entry per script. `hold` is how long to stay on a page, in milliseconds —
// long enough to speak the matching paragraph over it later.
const SCRIPTS = [
  {
    file: "01-ueberblick",
    as: "ADMIN",
    steps: [
      { path: "/app/sites", hold: 4000 },
      { path: "/app/s/{siteId}", hold: 8000 },
      { path: "/app/s/{siteId}/risk/workstations", hold: 8000 },
      { path: "/app/s/{siteId}/actions", hold: 7000 },
      { path: "/app/s/{siteId}/reports/kpis", hold: 7000 },
      { path: "/app/s/{siteId}/documents/generated", hold: 6000 },
    ],
  },
  {
    file: "02-gefaehrdungsbeurteilung",
    as: "EHS",
    steps: [
      { path: "/app/s/{siteId}/risk/workstations", hold: 7000 },
      { path: "/app/s/{siteId}/risk/assessments", hold: 9000 },
      { path: "/app/s/{siteId}/risk/floor-plan", hold: 6000 },
    ],
  },
  {
    file: "03-begehungen",
    as: "EHS",
    steps: [
      { path: "/app/s/{siteId}/inspections/templates", hold: 7000 },
      { path: "/app/s/{siteId}/inspections/planned", hold: 6000 },
      { path: "/app/s/{siteId}/inspections/performed", hold: 7000 },
    ],
  },
  {
    file: "04-ereignisse",
    as: "EHS",
    steps: [
      { path: "/app/s/{siteId}/incidents/reports", hold: 7000 },
      { path: "/app/s/{siteId}/incidents/notifications", hold: 9000 },
      { path: "/app/s/{siteId}/incidents/verbandbuch", hold: 6000 },
      { path: "/app/s/{siteId}/incidents/quick", hold: 5000 },
    ],
  },
  {
    file: "05-massnahmen",
    as: "EHS",
    steps: [
      { path: "/app/s/{siteId}/actions", hold: 8000 },
      { path: "/app/s/{siteId}/actions/effectiveness", hold: 7000 },
      { path: "/app/s/{siteId}/calendar", hold: 7000 },
      { path: "/app/me", hold: 6000 },
    ],
  },
  {
    file: "06-gefahrstoffe",
    as: "EHS",
    steps: [
      { path: "/app/s/{siteId}/chemicals/register", hold: 8000 },
      { path: "/app/s/{siteId}/chemicals/sds-review", hold: 8000 },
      { path: "/app/s/{siteId}/chemicals/deviations", hold: 7000 },
      { path: "/app/s/{siteId}/chemicals/operating-instructions", hold: 7000 },
      { path: "/app/s/{siteId}/chemicals/storage", hold: 5000 },
    ],
  },
  {
    file: "07-unterweisungen",
    as: "FUEHRUNG",
    steps: [
      { path: "/app/s/{siteId}/training/matrix", hold: 9000 },
      { path: "/app/s/{siteId}/training/sessions", hold: 7000 },
      // The refusal IS the point of this script's last beat.
      { path: "/app/s/{siteId}/legal/register", hold: 4000 },
    ],
  },
  {
    file: "08-rechtskataster",
    as: "EHS",
    steps: [
      { path: "/app/s/{siteId}/legal/register", hold: 9000 },
      { path: "/app/s/{siteId}/legal/review-due", hold: 6000 },
    ],
  },
  {
    file: "09-auswertungen",
    as: "ADMIN",
    steps: [
      { path: "/app/s/{siteId}/reports/kpis", hold: 10_000 },
      { path: "/app/s/{siteId}/reports", hold: 5000 },
    ],
  },
  {
    file: "10-rollen-und-zugang",
    as: "ADMIN",
    steps: [
      { path: "/app/s/{siteId}/settings/users", hold: 7000 },
      { path: "/app/s/{siteId}/settings/roles", hold: 8000 },
      { path: "/app/s/{siteId}/people/accounts", hold: 7000 },
    ],
  },
  {
    file: "10b-mitarbeitendensicht",
    as: "MITARBEIT",
    steps: [
      { path: "/app/me/instructions", hold: 7000 },
      { path: "/app/me/documents", hold: 6000 },
      { path: "/app/me/broadcasts", hold: 6000 },
      { path: "/app/me/incidents", hold: 5000 },
      // Refused on purpose: the employee role has no site surface.
      { path: "/app/s/{siteId}", hold: 4000 },
    ],
  },
];

async function demoSiteId() {
  const pg = await import("pg");
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
  if (!site) {
    throw new Error("No AT site in the DEMO tenant — run npm run seed:demo");
  }
  return site.id;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "Playwright is not installed (it is intentionally not a project dependency).\n" +
        "  npm i -D playwright && npx playwright install chromium\n" +
        "then re-run `npm run docs:videos`.",
    );
    process.exit(1);
  }

  const siteId = await demoSiteId();
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  try {
    for (const script of SCRIPTS) {
      const email = USERS[script.as];
      // One context per script, so each recording is its own file.
      const context = await browser.newContext({
        viewport: VIEWPORT,
        locale: "de-AT",
        colorScheme: "light",
        recordVideo: { dir: OUT_DIR, size: VIEWPORT },
      });
      // German, like every document this app produces for a DACH reader.
      await context.addCookies([
        { name: "statura-locale", value: "de", url: BASE },
      ]);
      const page = await context.newPage();

      await page.goto(`${BASE}/login`);
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/app/, { timeout: 30_000 });

      for (const step of script.steps) {
        const target = `${BASE}${step.path.replace("{siteId}", siteId)}`;
        // A deliberate refusal (a role opening a module it may not) is part of
        // two scripts, so a 404 must not abort the recording.
        await page
          .goto(target, { waitUntil: "networkidle" })
          .catch(() => undefined);
        await page.waitForTimeout(step.hold);
      }

      const video = page.video();
      await context.close(); // the video is only written on close
      if (video) {
        const temp = await video.path();
        renameSync(temp, join(OUT_DIR, `${script.file}.webm`));
      }
      console.log(`  ${script.file}.webm (${script.as})`);
    }
  } finally {
    await browser.close();
  }

  const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm"));
  console.log(`\n${files.length} recording(s) → docs/videos/raw/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
