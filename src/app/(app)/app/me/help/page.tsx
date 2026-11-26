import { HandbookContents } from "@/components/handbook/handbook-contents";
import { MeNav } from "@/components/me-nav";
import { HANDBOOK_CHAPTERS } from "@/generated/handbook";
import {
  requireAuthenticatedUser,
  requirePermissionOrNotFound,
} from "@/lib/auth/require-access";
import { showsProductOverview, visibleChapters } from "@/lib/handbook/chapters";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { getSelfPerson } from "@/lib/people/self-service";

// Hilfe for a reader with no site: a SELF-scoped employee's scope gives them no
// accessible site, so the site-scoped /app/s/[siteId]/help 404s for them even
// though their bundle carries `help.read` and the handbook has chapters written
// for them. This is the same handbook, same role filter, mounted where they can
// reach it. Gated on the permission alone — there is no site to check.
export default async function MyHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  await requirePermissionOrNotFound(user, "help.read");
  const { q } = await searchParams;
  const locale = await getLocale();
  const admin = getAdministrationDictionary(locale);
  const dict = admin.help;
  const selfDict = admin.selfService;
  const person = await getSelfPerson(user);

  // No site id to pass: the PDF route scopes by the requester's own role.
  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-8">
      <MeNav labels={selfDict} hasPerson={person !== null} />
      <HandbookContents
        chapters={visibleChapters(HANDBOOK_CHAPTERS, user.role)}
        query={(q ?? "").trim()}
        basePath="/app/me/help"
        pdfHref="/api/handbook/pdf"
        rolePdfHref={`/api/handbook/pdf?role=${user.role}`}
        overviewHref={
          showsProductOverview(user.role) ? "/api/overview/pdf" : null
        }
        dict={dict}
      />
    </div>
  );
}
