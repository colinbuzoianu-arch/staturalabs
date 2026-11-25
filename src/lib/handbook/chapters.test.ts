import { describe, expect, it } from "vitest";
import type { HandbookChapter } from "./chapters";
import {
  chapterForModule,
  groupByPart,
  searchChapters,
  visibleChapters,
} from "./chapters";

function chapter(over: Partial<HandbookChapter>): HandbookChapter {
  return {
    slug: "x",
    title: "Kapitel",
    part: 1,
    order: 10,
    roles: [],
    module: null,
    internal: false,
    summary: "",
    markdown: "",
    ...over,
  };
}

describe("visibleChapters", () => {
  const chapters = [
    chapter({ slug: "all", part: 1, order: 20 }),
    chapter({ slug: "leader", part: 3, order: 10, roles: ["MANAGER"] }),
    chapter({ slug: "admin-internal", part: 4, order: 10, internal: true }),
  ];

  it("shows the everyone-chapters to every role", () => {
    for (const role of ["EMPLOYEE", "MANAGER", "COMPANY_ADMIN"] as const) {
      expect(visibleChapters(chapters, role).map((c) => c.slug)).toContain(
        "all",
      );
    }
  });
  it("shows a role-scoped chapter only to that role", () => {
    expect(visibleChapters(chapters, "MANAGER").map((c) => c.slug)).toContain(
      "leader",
    );
    expect(
      visibleChapters(chapters, "EMPLOYEE").map((c) => c.slug),
    ).not.toContain("leader");
  });
  it("hides an internal chapter from every tenant role", () => {
    for (const role of [
      "COMPANY_ADMIN",
      "SITE_ADMIN",
      "EHS_SPECIALIST",
      "MANAGER",
      "EMPLOYEE",
      "WORKS_COUNCIL",
      "OCCUPATIONAL_PHYSICIAN",
    ] as const) {
      expect(visibleChapters(chapters, role).map((c) => c.slug)).not.toContain(
        "admin-internal",
      );
    }
  });
  it("shows an internal chapter to the platform roles", () => {
    for (const role of ["SUPER_ADMIN", "L3_SUPPORT"] as const) {
      expect(visibleChapters(chapters, role).map((c) => c.slug)).toContain(
        "admin-internal",
      );
    }
  });
  it("sorts by part, then order", () => {
    const sorted = visibleChapters(
      [
        chapter({ slug: "b", part: 2, order: 10 }),
        chapter({ slug: "c", part: 1, order: 20 }),
        chapter({ slug: "a", part: 1, order: 10 }),
      ],
      "COMPANY_ADMIN",
    );
    expect(sorted.map((c) => c.slug)).toEqual(["a", "c", "b"]);
  });
});

describe("groupByPart", () => {
  it("groups and titles the parts in order", () => {
    const groups = groupByPart([
      chapter({ slug: "m", part: 2, order: 10 }),
      chapter({ slug: "g", part: 1, order: 10 }),
    ]);
    expect(groups.map((g) => g.part)).toEqual([1, 2]);
    expect(groups[0].title).toContain("Teil 1");
    expect(groups[1].chapters[0].slug).toBe("m");
  });
});

describe("searchChapters", () => {
  const chapters = [
    chapter({
      slug: "unterweisungen",
      title: "Unterweisungen",
      summary: "Termine planen und Teilnahme erfassen.",
      markdown: "Eine Sicherheitsunterweisung wird jährlich wiederholt.",
    }),
    chapter({
      slug: "gefahrstoffe",
      title: "Gefahrstoffe",
      summary: "Register, SDB und Betriebsanweisungen.",
      markdown: "Das Sicherheitsdatenblatt wird eingelesen und geprüft.",
    }),
  ];

  it("finds a chapter by a word inside its body", () => {
    expect(
      searchChapters(chapters, "jährlich").map((h) => h.chapter.slug),
    ).toEqual(["unterweisungen"]);
  });
  it("matches German compounds by substring", () => {
    expect(
      searchChapters(chapters, "unterweisung").map((h) => h.chapter.slug),
    ).toEqual(["unterweisungen"]);
  });
  it("is umlaut- and case-insensitive", () => {
    expect(searchChapters(chapters, "GEPRUEFT").length).toBe(0);
    expect(
      searchChapters(chapters, "GEPRÜFT").map((h) => h.chapter.slug),
    ).toEqual(["gefahrstoffe"]);
  });
  it("requires every term (AND)", () => {
    expect(
      searchChapters(chapters, "sicherheitsdatenblatt geprüft").length,
    ).toBe(1);
    expect(
      searchChapters(chapters, "sicherheitsdatenblatt unterweisung").length,
    ).toBe(0);
  });
  it("ignores a one-character query rather than matching everything", () => {
    expect(searchChapters(chapters, "a")).toEqual([]);
    expect(searchChapters(chapters, "")).toEqual([]);
  });
  it("returns an excerpt", () => {
    const [hit] = searchChapters(chapters, "jährlich");
    expect(hit.excerpt).toContain("jährlich");
  });
});

describe("chapterForModule", () => {
  const chapters = [
    chapter({ slug: "risk", module: "RISK" }),
    chapter({ slug: "secret", module: "SETTINGS", internal: true }),
  ];
  it("finds the chapter documenting a module", () => {
    expect(chapterForModule(chapters, "RISK", "EHS_SPECIALIST")?.slug).toBe(
      "risk",
    );
  });
  it("is null when no visible chapter documents it, so no link is rendered", () => {
    expect(
      chapterForModule(chapters, "CHEMICALS", "EHS_SPECIALIST"),
    ).toBeNull();
    expect(chapterForModule(chapters, "SETTINGS", "COMPANY_ADMIN")).toBeNull();
  });
});
