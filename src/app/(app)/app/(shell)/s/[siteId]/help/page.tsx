import { HandbookContents } from "@/components/handbook/handbook-contents";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import { requireModuleAccess } from "@/lib/auth/require-access";
import { showsProductOverview, visibleChapters } from "@/lib/handbook/chapters";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// P18 B.1: Hilfe — the handbook's table of contents, filtered by the reader's
// role, plus search.
//
// The search is a plain GET form on the query string: no client JS, no new data
// path, and a search result is a shareable link. The chapters come from the
// generated module (compiled from docs/handbuch/de/**), so this page reads no
// filesystem at runtime. The rendering is shared with /app/me/help, which is
// the same handbook for a SELF-scoped reader who has no accessible site.
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

  return (
    <HandbookContents
      chapters={visibleChapters(HANDBOOK_CHAPTERS, user.role)}
      query={(q ?? "").trim()}
      basePath={`/app/s/${siteId}/help`}
      pdfHref={`/api/handbook/pdf?siteId=${siteId}`}
      rolePdfHref={`/api/handbook/pdf?siteId=${siteId}&role=${user.role}`}
      overviewHref={
        showsProductOverview(user.role) ? "/api/overview/pdf" : null
      }
      dict={dict}
    />
  );
}
