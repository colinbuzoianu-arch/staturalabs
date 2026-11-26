import type { PlatformRole } from "@/generated/prisma/enums";
import type { ModuleKey } from "@/lib/modules/registry";
import { handbookMarkdownToText } from "./markdown";

// P18 B.1: the handbook's shape, its role filter and its search.
//
// The SOURCE is Markdown in docs/handbuch/de/**. scripts/build-handbook.mjs
// compiles it into src/generated/handbook.ts, which is what the app imports —
// so the app never reads the filesystem at runtime (that would be fragile on a
// serverless deployment), while the markdown stays the single source the PDF
// export, the CI checks and a future en/ translation all read.
//
// Everything in this file is pure and unit-tested; the generated module is
// plain data.

export type HandbookPart = 1 | 2 | 3 | 4 | 5 | 6;

export type HandbookChapter = {
  // Stable slug = the route segment and the PDF bookmark.
  slug: string;
  title: string;
  part: HandbookPart;
  order: number;
  // Which roles see this chapter in their table of contents. Empty = everyone.
  roles: PlatformRole[];
  // The module this chapter documents, for "Hilfe zu diesem Modul".
  module: ModuleKey | null;
  // INTERNAL chapters (the super-admin one) are never rendered for a tenant
  // and never included in a tenant-facing PDF (B.2).
  internal: boolean;
  summary: string;
  markdown: string;
};

export const HANDBOOK_PART_TITLES: Record<HandbookPart, string> = {
  1: "Teil 1 — Grundlagen",
  2: "Teil 2 — Module",
  3: "Teil 3 — Rollen",
  4: "Teil 4 — Administration",
  5: "Teil 5 — Datenschutz & Sicherheit",
  6: "Glossar",
};

// Which chapters a reader may see. Two independent rules:
//   * internal chapters are for the platform roles only (super_admin /
//     l3_support), never for a tenant;
//   * a chapter with an explicit role list is shown only to those roles —
//     an empty list means "everyone", which is the common case.
// Fail-closed on an unknown role: it gets the everyone-chapters only.
export function visibleChapters(
  chapters: readonly HandbookChapter[],
  role: PlatformRole,
): HandbookChapter[] {
  const isPlatform = role === "SUPER_ADMIN" || role === "L3_SUPPORT";
  return chapters
    .filter((c) => (c.internal ? isPlatform : true))
    .filter((c) => c.roles.length === 0 || c.roles.includes(role))
    .sort((a, b) => a.part - b.part || a.order - b.order);
}

export type HandbookGroup = {
  part: HandbookPart;
  title: string;
  chapters: HandbookChapter[];
};

export function groupByPart(
  chapters: readonly HandbookChapter[],
): HandbookGroup[] {
  const byPart = new Map<HandbookPart, HandbookChapter[]>();
  for (const chapter of chapters) {
    const list = byPart.get(chapter.part) ?? [];
    list.push(chapter);
    byPart.set(chapter.part, list);
  }
  return [...byPart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([part, list]) => ({
      part,
      title: HANDBOOK_PART_TITLES[part],
      chapters: [...list].sort((a, b) => a.order - b.order),
    }));
}

export type HandbookHit = {
  chapter: HandbookChapter;
  // The matching line, for a one-line result preview.
  excerpt: string;
};

// Search: all terms must appear (AND), case- and umlaut-insensitively, in the
// title, the summary or the body. Deliberately substring matching rather than
// word matching — German compounds mean a reader searching "unterweisung"
// should find "Unterweisungen" and "Sicherheitsunterweisung".
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
}

export function searchChapters(
  chapters: readonly HandbookChapter[],
  query: string,
  limit = 20,
): HandbookHit[] {
  const terms = normalise(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  if (terms.length === 0) return [];

  const hits: HandbookHit[] = [];
  for (const chapter of chapters) {
    const text = handbookMarkdownToText(chapter.markdown);
    const haystack = normalise(`${chapter.title} ${chapter.summary} ${text}`);
    if (!terms.every((t) => haystack.includes(t))) continue;

    // The excerpt is the first line that contains the first term; the title
    // when the match is only in the title/summary.
    const line = text
      .split("\n")
      .find((l) => normalise(l).includes(terms[0]))
      ?.trim();
    hits.push({
      chapter,
      excerpt: (line && line.length > 0 ? line : chapter.summary).slice(0, 180),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

// The chapter that documents a module, for the per-page "Hilfe zu diesem
// Modul" link. Null when a module has no chapter yet, so the link is simply
// not rendered rather than pointing at a 404.
export function chapterForModule(
  chapters: readonly HandbookChapter[],
  module: ModuleKey,
  role: PlatformRole,
): HandbookChapter | null {
  return (
    visibleChapters(chapters, role).find((c) => c.module === module) ?? null
  );
}

// Who is offered the Produktüberblick (P18 B.4): the roles that would hand it
// on. One decision, so the two Hilfe surfaces cannot disagree about it.
export function showsProductOverview(role: PlatformRole): boolean {
  return (
    role === "COMPANY_ADMIN" ||
    role === "SITE_ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "L3_SUPPORT"
  );
}
