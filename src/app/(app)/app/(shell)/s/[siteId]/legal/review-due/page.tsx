import Link from "next/link";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P11 §6.4: requirements whose compliance review is due/overdue, or that a
// catalogue change flagged for review. Feeds the notification service (the
// review-due event); here it's the human-facing list.
export default async function LegalReviewDuePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).legal;
  const now = new Date();

  const links = await prisma.siteLegalRequirement.findMany({
    where: {
      siteId,
      OR: [
        { reviewRequired: true },
        { evaluation: { nextReviewDue: { lte: now } } },
      ],
    },
    include: {
      legalRequirement: { select: { code: true, title: true } },
      evaluation: { select: { state: true, nextReviewDue: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.reviewDueHeading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {dict.reviewDueIntro}
        </p>
      </div>

      {links.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.reviewDueEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colCode}</th>
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colCompliance}</th>
              <th className="py-1 pr-4">{dict.colReview}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {links.map((l) => {
              const due = l.evaluation?.nextReviewDue ?? null;
              const overdue = due !== null && due <= now;
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 font-technical text-xs text-foreground-subtle">
                    {l.legalRequirement.code}
                  </td>
                  <td className="py-1.5 pr-4 font-medium text-foreground">
                    {l.legalRequirement.title}
                    {l.reviewRequired ? (
                      <span className="ml-2 text-xs text-info">
                        {dict.reviewRequiredFlag}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {
                      dict.complianceLabels[
                        l.evaluation?.state ?? "NOT_EVALUATED"
                      ]
                    }
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {due ? due.toISOString().slice(0, 10) : dict.none}
                    {overdue ? ` (${dict.overdueLabel})` : ""}
                  </td>
                  <td className="py-1.5">
                    <Link
                      href={`/app/s/${siteId}/legal/register`}
                      className="text-accent hover:underline"
                    >
                      {dict.openLink}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
