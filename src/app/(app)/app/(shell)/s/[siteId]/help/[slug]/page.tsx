import { notFound } from "next/navigation";
import { HandbookChapterView } from "@/components/handbook/handbook-chapter-view";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import { requireModuleAccess } from "@/lib/auth/require-access";
import { visibleChapters } from "@/lib/handbook/chapters";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// One handbook chapter, with its own on-page contents.
//
// A chapter the reader's role may not see 404s rather than redirecting — the
// same fail-closed posture as every other resource here, and it keeps the
// internal super-admin chapter genuinely out of a tenant's reach rather than
// merely out of their menu.
export default async function HelpChapterPage({
  params,
}: {
  params: Promise<{ siteId: string; slug: string }>;
}) {
  const { siteId, slug } = await params;
  const { user } = await requireModuleAccess("HELP", siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).help;

  const mine = visibleChapters(HANDBOOK_CHAPTERS, user.role);
  const index = mine.findIndex((c) => c.slug === slug);
  if (index === -1) notFound();

  return (
    <HandbookChapterView
      chapter={mine[index]}
      previous={index > 0 ? mine[index - 1] : null}
      next={index < mine.length - 1 ? mine[index + 1] : null}
      basePath={`/app/s/${siteId}/help`}
      dict={dict}
    />
  );
}
