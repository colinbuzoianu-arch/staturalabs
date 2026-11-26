import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import type { HandbookChapter } from "@/lib/handbook/chapters";
import { groupByPart, searchChapters } from "@/lib/handbook/chapters";
import type { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";

// P18 B.1: the handbook's table of contents and its search, as one component
// used by BOTH Hilfe surfaces — the site-scoped one under a module shell and
// the self-service one under /app/me for a role whose scope is SELF and which
// therefore has no accessible site at all. One rendering, two mount points:
// the alternative was a second copy that would drift.
//
// `basePath` is the only difference between the two, so every link is built
// from it (base-path safe: it is an in-app path, and Next applies the
// deployment's basePath to <Link> itself).

type HelpDictionary = ReturnType<typeof getAdministrationDictionary>["help"];

export function HandbookContents({
  chapters,
  query,
  basePath,
  pdfHref,
  rolePdfHref,
  overviewHref,
  dict,
}: {
  chapters: HandbookChapter[];
  query: string;
  basePath: string;
  pdfHref: string;
  rolePdfHref: string;
  // Null for the roles that have no use for the sales document.
  overviewHref: string | null;
  dict: HelpDictionary;
}) {
  const hits = query.length > 0 ? searchChapters(chapters, query) : [];
  const groups = groupByPart(chapters);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <a href={pdfHref} className="text-accent hover:underline">
            {dict.pdfFull}
          </a>
          <a href={rolePdfHref} className="text-accent hover:underline">
            {dict.pdfRole}
          </a>
          {overviewHref && (
            <a href={overviewHref} className="text-accent hover:underline">
              {dict.pdfOverview}
            </a>
          )}
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          {dict.searchLabel}
          <input
            name="q"
            defaultValue={query}
            placeholder={dict.searchPlaceholder}
            className="w-72 rounded border border-border bg-background px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
        >
          {dict.searchButton}
        </button>
        {query.length > 0 && (
          <Link
            href={basePath}
            className="pb-2 text-foreground-subtle hover:text-accent hover:underline"
          >
            {dict.searchClear}
          </Link>
        )}
      </form>

      {query.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold">
            {dict.searchResults.replace("{count}", String(hits.length))}
          </h2>
          {hits.length === 0 ? (
            <p className="text-sm text-foreground-muted">{dict.searchEmpty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {hits.map((hit) => (
                <li key={hit.chapter.slug}>
                  <Link
                    href={`${basePath}/${hit.chapter.slug}`}
                    className="font-heading font-bold text-foreground hover:text-accent hover:underline"
                  >
                    {hit.chapter.title}
                  </Link>
                  <p className="text-sm text-foreground-muted">{hit.excerpt}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.part} className="flex flex-col gap-2">
              <h2 className="font-heading text-sm font-bold">{group.title}</h2>
              <Card>
                <CardBody className="flex flex-col gap-3">
                  {group.chapters.map((chapter) => (
                    <div key={chapter.slug} className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`${basePath}/${chapter.slug}`}
                          className="font-medium text-foreground hover:text-accent hover:underline"
                        >
                          {chapter.title}
                        </Link>
                        {chapter.internal && (
                          <Badge tone="outline">{dict.internalBadge}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground-muted">
                        {chapter.summary}
                      </p>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
