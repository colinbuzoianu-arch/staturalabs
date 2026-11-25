// P18 B.1: compile the handbook's Markdown source into a generated TypeScript
// module the app imports.
//
// Why generate instead of reading the filesystem at runtime: a server
// component that reads docs/ works locally and is fragile on a serverless
// deployment (the files have to be traced into the bundle). Generating keeps
// the Markdown as the single source — the PDF export, the CI checks and a
// future en/ translation all read it — while the app imports plain data.
//
// Idempotent: run it after editing a chapter. CI runs it and fails if the
// generated file is not what the sources produce (so the two cannot drift).
//
// Usage: npm run docs:handbook
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_DIR = join(process.cwd(), "docs", "handbuch", "de");
const OUT_FILE = join(process.cwd(), "src", "generated", "handbook.ts");

// A chapter file starts with a `---` frontmatter block. Deliberately a tiny
// key: value parser rather than a YAML dependency — the keys are fixed and a
// typo should be a loud error, not a silently-accepted nested structure.
function parseFrontmatter(raw, file) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(
    raw.replace(/\r\n/g, "\n"),
  );
  if (!match) throw new Error(`${file}: missing --- frontmatter block`);
  const meta = {};
  for (const line of match[1].split("\n")) {
    if (line.trim().length === 0) continue;
    const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`${file}: cannot parse frontmatter line: ${line}`);
    meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: match[2].trim() };
}

function parseList(value) {
  if (!value || value === "[]") return [];
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

const REQUIRED = ["title", "part", "order", "summary"];

function main() {
  let files;
  try {
    files = readdirSync(SOURCE_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    console.error(`No handbook sources at ${SOURCE_DIR}`);
    process.exit(1);
  }

  const chapters = [];
  const slugs = new Set();
  for (const file of files) {
    const raw = readFileSync(join(SOURCE_DIR, file), "utf8");
    const { meta, body } = parseFrontmatter(raw, file);
    for (const key of REQUIRED) {
      if (!meta[key]) throw new Error(`${file}: frontmatter is missing ${key}`);
    }
    // The slug comes from the filename (NN-slug.md), so the route segment and
    // the file order are one decision, not two that can disagree.
    const slug = file.replace(/^\d+-/, "").replace(/\.md$/, "");
    if (slugs.has(slug)) throw new Error(`${file}: duplicate slug ${slug}`);
    slugs.add(slug);
    chapters.push({
      slug,
      title: meta.title,
      part: Number.parseInt(meta.part, 10),
      order: Number.parseInt(meta.order, 10),
      roles: parseList(meta.roles),
      module: meta.module && meta.module !== "none" ? meta.module : null,
      internal: meta.internal === "true",
      summary: meta.summary,
      markdown: body,
    });
  }

  chapters.sort((a, b) => a.part - b.part || a.order - b.order);

  const header = `// GENERATED FILE — do not edit.
//
// Source: docs/handbuch/de/*.md · Generator: scripts/build-handbook.mjs
// Run \`npm run docs:handbook\` after editing a chapter. CI fails if this file
// is not what the sources produce (scripts/check-handbook.mjs), so the two
// cannot drift.

import type { HandbookChapter } from "@/lib/handbook/chapters";

export const HANDBOOK_CHAPTERS: readonly HandbookChapter[] = ${JSON.stringify(
    chapters,
    null,
    2,
  )} as const;
`;

  mkdirSync(join(process.cwd(), "src", "generated"), { recursive: true });
  writeFileSync(OUT_FILE, header, "utf8");
  console.log(
    `handbook: ${chapters.length} chapter(s) → src/generated/handbook.ts`,
  );
}

main();
