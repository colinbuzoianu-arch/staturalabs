import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P9 §7.3: inspection templates (read-only list). System templates (companyId
// null) plus the company's own. Editing/creating company templates is a
// recorded follow-up — v1 ships the system walk-through + the run flow.
export default async function InspectionTemplatesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).inspections;

  const templates = await prisma.inspectionTemplate.findMany({
    where: {
      isActive: true,
      OR: [{ companyId: null }, { companyId: site.companyId }],
    },
    include: {
      _count: { select: { sections: true } },
      sections: { select: { _count: { select: { questions: true } } } },
    },
    orderBy: [{ isSystem: "desc" }, { title: "asc" }],
  });

  function scopeLabel(t: (typeof templates)[number]): string {
    if (t.companyId === null) return dict.scopeSystem;
    if (t.siteId === null) return dict.scopeCompany;
    return dict.scopeSite;
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.templatesHeading}
        </h1>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-foreground-muted">{dict.templatesEmpty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colTemplate}</th>
              <th className="py-1 pr-4">{dict.colType}</th>
              <th className="py-1 pr-4">{dict.colScope}</th>
              <th className="py-1 pr-4">{dict.colQuestions}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const questions = t.sections.reduce(
                (n, s) => n + s._count.questions,
                0,
              );
              return (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 font-medium text-foreground">
                    {t.title}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {dict.typeLabels[t.type]}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {scopeLabel(t)}
                  </td>
                  <td className="py-1.5 pr-4 text-foreground-muted">
                    {questions}
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
