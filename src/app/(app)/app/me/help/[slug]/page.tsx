import { notFound } from "next/navigation";
import { HandbookChapterView } from "@/components/handbook/handbook-chapter-view";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import {
  requireAuthenticatedUser,
  requirePermissionOrNotFound,
} from "@/lib/auth/require-access";
import { visibleChapters } from "@/lib/handbook/chapters";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// One handbook chapter, for the site-less Hilfe (see ../page.tsx). A chapter
// the reader's role may not see 404s, exactly as on the site-scoped surface —
// the internal chapter stays out of reach, not merely out of the menu.
export default async function MyHelpChapterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireAuthenticatedUser();
  await requirePermissionOrNotFound(user, "help.read");
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
      basePath="/app/me/help"
      dict={dict}
    />
  );
}
