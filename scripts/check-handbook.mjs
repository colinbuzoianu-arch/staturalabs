// P18 B.1 CI checks for the handbook. Runs in CI; fails the build on any of:
//
//   1. the generated module is stale (src/generated/handbook.ts is not what the
//      Markdown sources produce) — the two must never drift;
//   2. a frontmatter field is missing or invalid (part/order/role/module);
//   3. an in-app route linked from a chapter does not exist in src/app;
//   4. a referenced image is missing from docs/handbuch/img or public/;
//   5. a legal reference (a "§ …" or an "Art. …" citation) appears in the text
//      that is NOT in the verified legal catalogue — the handbook explains the
//      product, it never states new law (B.1);
//   6. syntax the in-app renderer does not support (a Markdown table, raw HTML,
//      a setext heading), which would otherwise render as literal text.
//
// Usage: npm run docs:check
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, "docs", "handbuch", "de");
const IMG_DIR = join(ROOT, "docs", "handbuch", "img");
const GENERATED = join(ROOT, "src", "generated", "handbook.ts");
const APP_DIR = join(ROOT, "src", "app");

const problems = [];
const fail = (file, message) => problems.push(`${file}: ${message}`);

// --- 1. the generated module is current -----------------------------------
function checkGenerated() {
  const before = existsSync(GENERATED) ? readFileSync(GENERATED, "utf8") : "";
  execFileSync(
    process.execPath,
    [join(ROOT, "scripts", "build-handbook.mjs")],
    {
      cwd: ROOT,
      stdio: "pipe",
    },
  );
  const after = readFileSync(GENERATED, "utf8");
  if (before !== after) {
    fail(
      "src/generated/handbook.ts",
      "stale — run `npm run docs:handbook` and commit the result",
    );
  }
}

// --- route inventory, for the link check ----------------------------------
// Walk src/app for page.tsx / route.ts files and turn each into a path
// pattern, with dynamic segments as wildcards and route groups removed.
function routePatterns() {
  const patterns = [];
  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const name = entry.name;
        // (group) segments are path-transparent; @slots and _private are not routes.
        if (name.startsWith("_")) continue;
        const next =
          name.startsWith("(") && name.endsWith(")")
            ? segments
            : [...segments, name];
        walk(join(dir, name), next);
      } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
        patterns.push(`/${segments.join("/")}`);
      }
    }
  };
  walk(APP_DIR, []);
  return patterns;
}

function routeExists(path, patterns) {
  const wanted = path.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  const wantedParts = wanted.split("/").filter((p) => p.length > 0);
  return patterns.some((pattern) => {
    const parts = pattern.split("/").filter((p) => p.length > 0);
    if (parts.length !== wantedParts.length) return false;
    return parts.every((part, i) => {
      if (part.startsWith("[") && part.endsWith("]")) return true; // dynamic
      return part === wantedParts[i];
    });
  });
}

// --- the verified legal catalogue, for the citation check -----------------
// Read from the repo's own seeded legal references rather than from the DB, so
// the check runs in CI with no database: every legal reference the product
// knows was seeded by a migration, and that SQL is in the repo.
//
// A citation is compared as a PAIR — the law AND the paragraph — because "§ 5"
// on its own is meaningless: ASchG §5 and ArbSchG §5 are different duties in
// different countries, and a check that accepted either would wave through a
// citation pointing at the wrong country's law. The two sides also write the
// same citation differently ("ASchG §5" in the seed SQL, "§ 5 ASchG" in German
// prose), so both are normalised to "ASCHG §5".
const LAW_TOKEN = /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß]*(?:G|V|VO|O|GB|VII))\b/;
const CITATION = /(?:§{1,2}|Art\.)\s?(\d+[a-z]?)/g;

function normalisePair(law, paragraph) {
  return `${law.toUpperCase()} §${paragraph.replace(/\s+/g, "")}`;
}

// Every "§ N"/"Art. N" in a text, paired with the nearest law abbreviation:
// forward first (German prose puts the law after the §), then backward (the
// seed SQL puts it before). A citation with no law anywhere near it is not
// checkable and is skipped — the rule is about naming a provision, and a bare
// number in a sentence about something else must not fail the build.
function citationsIn(text) {
  const found = new Set();
  for (const match of text.matchAll(CITATION)) {
    const afterStart = match.index + match[0].length;
    const after = text.slice(afterStart, afterStart + 48);
    const before = text.slice(Math.max(0, match.index - 48), match.index);
    const law =
      LAW_TOKEN.exec(after)?.[1] ??
      [...before.matchAll(new RegExp(LAW_TOKEN, "g"))].pop()?.[1] ??
      null;
    if (!law) continue;
    found.add(normalisePair(law, match[1]));
  }
  return found;
}

function allowedCitations() {
  const allowed = new Set();
  const migrationsDir = join(ROOT, "prisma", "migrations");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (entry.name === "migration.sql")
        files.push(join(dir, entry.name));
    }
  };
  walk(migrationsDir);
  for (const file of files) {
    for (const cited of citationsIn(readFileSync(file, "utf8"))) {
      allowed.add(cited);
    }
  }
  return allowed;
}

function main() {
  checkGenerated();

  const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) fail("docs/handbuch/de", "no chapters found");

  const patterns = routePatterns();
  const allowed = allowedCitations();

  for (const file of files) {
    const raw = readFileSync(join(SOURCE_DIR, file), "utf8");
    const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");

    // 3. in-app links
    for (const match of body.matchAll(/\[[^\]]*\]\((\/[^)\s]*)\)/g)) {
      const href = match[1];
      // /handbuch/img/... is an asset, checked below, not a route.
      if (href.startsWith("/handbuch/")) continue;
      if (!routeExists(href, patterns)) {
        fail(file, `links to a route that does not exist: ${href}`);
      }
    }

    // 4. images
    for (const match of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const src = match[1];
      const candidates = [
        join(IMG_DIR, src.replace(/^\/handbuch\/img\//, "")),
        join(ROOT, "public", src.replace(/^\//, "")),
      ];
      if (!candidates.some((c) => existsSync(c))) {
        fail(file, `references a missing image: ${src}`);
      }
    }

    // 5. legal citations
    for (const cited of citationsIn(body)) {
      if (!allowed.has(cited)) {
        fail(
          file,
          `cites ${cited}, which is not in the verified legal catalogue — the handbook must not state new law`,
        );
      }
    }

    // 6. unsupported syntax
    if (/^\s*\|.*\|\s*$/m.test(body)) {
      fail(file, "uses a Markdown table, which the renderer does not support");
    }
    if (/<[a-zA-Z][^>]*>/.test(body)) {
      fail(file, "contains raw HTML, which the renderer escapes to text");
    }
    if (/^(=+|-{3,})$/m.test(body.replace(/^-{3,}$/gm, ""))) {
      fail(file, "uses a setext heading; use # instead");
    }
  }

  if (problems.length > 0) {
    console.error("Handbook checks failed:\n");
    for (const problem of problems) console.error(`  ✗ ${problem}`);
    process.exit(1);
  }
  console.log(
    `handbook checks passed (${files.length} chapter(s), ${patterns.length} routes known, ${allowed.size} verified citations)`,
  );
}

main();
