import { revalidatePath } from "next/cache";
import Link from "next/link";
import { InspectionDomain, InspectionType } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { createInspectionTemplate } from "@/lib/inspections/inspection-template";
import { prisma } from "@/lib/prisma";

const TYPES = Object.values(InspectionType);
const DOMAINS = Object.values(InspectionDomain);

// P9 §7.3: inspection templates. System templates (companyId null) are read-
// only; a site/company admin can create and open their own company templates.
export default async function InspectionTemplatesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).inspections;

  async function createTemplateAction(formData: FormData) {
    "use server";
    const { user, site } = await requireSiteAdministrationAccess(siteId);
    if (!site.companyId) return;
    const title = formData.get("title");
    const type = formData.get("type");
    const domain = formData.get("domain");
    const description = formData.get("description");
    if (
      typeof title !== "string" ||
      title.trim().length === 0 ||
      typeof type !== "string" ||
      !(TYPES as string[]).includes(type) ||
      typeof domain !== "string" ||
      !(DOMAINS as string[]).includes(domain)
    ) {
      return;
    }
    await createInspectionTemplate({
      companyId: site.companyId,
      type: type as InspectionType,
      domain: domain as InspectionDomain,
      title,
      description: typeof description === "string" ? description : null,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/inspections/templates`);
  }

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

  const fieldClass =
    "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm";
  const labelTextClass = "text-xs font-medium text-foreground-muted";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.templatesHeading}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: create template */}
        <section className="flex flex-col gap-3 self-start rounded-lg border border-border bg-surface p-5">
          <h2 className="font-heading text-lg font-bold">
            {dict.createTemplateHeading}
          </h2>
          <form action={createTemplateAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelTextClass}>{dict.templateTitleLabel}</span>
              <input name="title" required className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelTextClass}>{dict.templateTypeLabel}</span>
              <select name="type" className={fieldClass}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {dict.typeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelTextClass}>{dict.templateDomainLabel}</span>
              <select name="domain" className={fieldClass}>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {dict.domainLabels[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={labelTextClass}>
                {dict.templateDescriptionLabel}
              </span>
              <input name="description" className={fieldClass} />
            </label>
            <button
              type="submit"
              className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              {dict.createTemplateButton}
            </button>
          </form>
        </section>

        {/* Right: template list */}
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold">
            {dict.templatesHeading}
          </h2>
          {templates.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              {dict.templatesEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((t) => {
                const questions = t.sections.reduce(
                  (n, s) => n + s._count.questions,
                  0,
                );
                return (
                  <li key={t.id}>
                    <Link
                      href={`/app/s/${siteId}/inspections/templates/${t.id}`}
                      className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3 hover:border-accent"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {t.title}
                        </span>
                        <span className="text-xs text-border">
                          {scopeLabel(t)}
                        </span>
                      </span>
                      <span className="text-xs text-border">
                        {dict.typeLabels[t.type]} · {dict.colQuestions}:{" "}
                        {questions}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
