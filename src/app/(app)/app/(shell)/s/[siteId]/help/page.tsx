import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import { requireModuleAccess } from "@/lib/auth/require-access";
import {
  groupByPart,
  searchChapters,
  visibleChapters,
} from "@/lib/handbook/chapters";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// P18 B.1: Hilfe — the handbook's table of contents, filtered by the reader's
// role, plus search.
//
// The search is a plain GET form on the query string: no client JS, no new data
// path, and a search result is a shareable link. The chapters come from the
// generated module (compiled from docs/handbuch/de/**), so this page reads no
// filesystem at runtime.
export default async function HelpPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { siteId } = await params;
  const { q } = await searchParams;
  const { user } = await requireModuleAccess("HELP", siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).help;

  const mine = visibleChapters(HANDBOOK_CHAPTERS, user.role);
  const query = (q ?? "").trim();
  const hits = query.length > 0 ? searchChapters(mine, query) : [];
  const groups = groupByPart(mine);

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
          <a
            href={`/api/handbook/pdf?siteId=${siteId}`}
            className="text-accent hover:underline"
          >
            {dict.pdfFull}
          </a>
          <a
            href={`/api/handbook/pdf?siteId=${siteId}&role=${user.role}`}
            className="text-accent hover:underline"
          >
            {dict.pdfRole}
          </a>
          {/* The sales document (P18 B.4). Shown to the roles that would hand
              it on — not to every employee, who has no use for it. */}
          {(user.role === "COMPANY_ADMIN" ||
            user.role === "SITE_ADMIN" ||
            user.role === "SUPER_ADMIN" ||
            user.role === "L3_SUPPORT") && (
            <a href="/api/overview/pdf" className="text-accent hover:underline">
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
            href={`/app/s/${siteId}/help`}
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
                    href={`/app/s/${siteId}/help/${hit.chapter.slug}`}
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
                          href={`/app/s/${siteId}/help/${chapter.slug}`}
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
