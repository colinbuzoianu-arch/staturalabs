import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectionAnswerType } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import {
  addTemplateQuestion,
  addTemplateSection,
} from "@/lib/inspections/inspection-template";
import { prisma } from "@/lib/prisma";

const ANSWER_TYPES = Object.values(InspectionAnswerType);

// Open an inspection template: its sections and questions. System templates are
// read-only; a company's own templates can be extended here (add sections and
// questions), gated by requireSiteAdministrationAccess.
export default async function InspectionTemplateDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; templateId: string }>;
}) {
  const { siteId, templateId } = await params;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).inspections;

  const template = await prisma.inspectionTemplate.findUnique({
    where: { id: templateId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { questions: { orderBy: { order: "asc" } } },
      },
    },
  });
  // Visible only if it's a system template or belongs to this site's company.
  if (
    !template ||
    (template.companyId !== null && template.companyId !== site.companyId)
  ) {
    notFound();
  }
  const editable = !template.isSystem && template.companyId === site.companyId;

  async function addSectionAction(formData: FormData) {
    "use server";
    const { user, site } = await requireSiteAdministrationAccess(siteId);
    if (!site.companyId) return;
    const title = formData.get("title");
    if (typeof title !== "string" || title.trim().length === 0) return;
    await addTemplateSection({
      templateId,
      companyId: site.companyId,
      title,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/inspections/templates/${templateId}`);
  }

  async function addQuestionAction(formData: FormData) {
    "use server";
    const { user, site } = await requireSiteAdministrationAccess(siteId);
    if (!site.companyId) return;
    const sectionId = formData.get("sectionId");
    const prompt = formData.get("prompt");
    const answerType = formData.get("answerType");
    const required = formData.get("required") === "on";
    if (
      typeof sectionId !== "string" ||
      typeof prompt !== "string" ||
      prompt.trim().length === 0 ||
      typeof answerType !== "string" ||
      !(ANSWER_TYPES as string[]).includes(answerType)
    ) {
      return;
    }
    await addTemplateQuestion({
      sectionId,
      companyId: site.companyId,
      prompt,
      answerType: answerType as InspectionAnswerType,
      required,
      actorUserId: user.id,
    });
    revalidatePath(`/app/s/${siteId}/inspections/templates/${templateId}`);
  }

  const scope =
    template.companyId === null
      ? dict.scopeSystem
      : template.siteId === null
        ? dict.scopeCompany
        : dict.scopeSite;
  const fieldClass =
    "rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/app/s/${siteId}/inspections/templates`}
          className="text-sm text-accent hover:underline"
        >
          ← {dict.templateDetailBack}
        </Link>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {template.title}
        </h1>
        <p className="text-sm text-foreground-muted">
          {dict.typeLabels[template.type]} ·{" "}
          {dict.domainLabels[template.domain]} · {scope}
        </p>
        {template.description && (
          <p className="text-sm text-foreground-muted">
            {template.description}
          </p>
        )}
        {!editable && (
          <p className="text-xs text-foreground-subtle">
            {dict.systemTemplateReadOnly}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">
          {dict.sectionsHeading}
        </h2>

        {template.sections.length === 0 ? (
          <p className="text-sm text-foreground-muted">{dict.noSectionsYet}</p>
        ) : (
          template.sections.map((section) => (
            <div
              key={section.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              <h3 className="font-heading text-base font-bold">
                {section.title}
              </h3>
              {section.questions.length === 0 ? null : (
                <ol className="flex flex-col gap-1.5 text-sm">
                  {section.questions.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-start justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0"
                    >
                      <span className="text-foreground">{q.prompt}</span>
                      <span className="shrink-0 text-xs text-border">
                        {dict.answerTypeLabels[q.answerType]} ·{" "}
                        {q.required ? dict.requiredTag : dict.optionalTag}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              {editable && (
                <form
                  action={addQuestionAction}
                  className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
                >
                  <input type="hidden" name="sectionId" value={section.id} />
                  <label className="flex flex-1 flex-col gap-1 text-xs">
                    {dict.questionPromptLabel}
                    <input
                      name="prompt"
                      required
                      className={`${fieldClass} w-full`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    {dict.answerTypeLabel}
                    <select name="answerType" className={fieldClass}>
                      {ANSWER_TYPES.map((a) => (
                        <option key={a} value={a}>
                          {dict.answerTypeLabels[a]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name="required" defaultChecked />
                    {dict.requiredLabel}
                  </label>
                  <button
                    type="submit"
                    className="rounded-[var(--radius-md)] border border-border px-3 py-2 text-xs hover:border-accent"
                  >
                    {dict.addQuestionButton}
                  </button>
                </form>
              )}
            </div>
          ))
        )}

        {editable && (
          <form
            action={addSectionAction}
            className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4"
          >
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-foreground-muted">
                {dict.sectionTitleLabel}
              </span>
              <input name="title" required className={`${fieldClass} w-full`} />
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              {dict.addSectionButton}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
