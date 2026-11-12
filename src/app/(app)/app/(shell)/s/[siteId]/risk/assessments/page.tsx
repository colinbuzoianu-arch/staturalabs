import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AssessmentSubjectFields } from "@/components/risk/assessment-subject-fields";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { createRiskAssessment } from "@/lib/risk/risk-assessment";

export default async function RiskAssessmentsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).riskAssessmentsPage;
  const statusLabels =
    getAdministrationDictionary(locale).riskAssessmentStatusLabels;

  async function createRiskAssessmentAction(formData: FormData) {
    "use server";
    const { user } = await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(
      await getLocale(),
    ).riskAssessmentsPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const subjectType = formData.get("subjectType");
    const workstationId = formData.get("workstationId");
    const processId = formData.get("processId");

    const assessedAtRaw = formData.get("assessedAt");
    if (
      typeof assessedAtRaw !== "string" ||
      assessedAtRaw.trim().length === 0
    ) {
      throw new Error(dict.assessedAtRequired);
    }
    const assessedAt = new Date(assessedAtRaw);
    if (Number.isNaN(assessedAt.getTime())) {
      throw new Error(dict.assessedAtRequired);
    }

    const pilotContextRaw = formData.get("pilotContext");
    const pilotContext =
      typeof pilotContextRaw === "string" && pilotContextRaw.trim().length > 0
        ? pilotContextRaw.trim()
        : null;

    const notesRaw = formData.get("notes");
    const notes =
      typeof notesRaw === "string" && notesRaw.trim().length > 0
        ? notesRaw.trim()
        : null;

    const isWorkstation =
      subjectType === "workstation" &&
      typeof workstationId === "string" &&
      workstationId.length > 0;
    const isProcess =
      subjectType === "process" &&
      typeof processId === "string" &&
      processId.length > 0;

    if (!isWorkstation && !isProcess) {
      throw new Error(dict.subjectRequired);
    }

    try {
      await createRiskAssessment({
        siteId,
        workstationId: isWorkstation ? (workstationId as string) : null,
        processId: isProcess ? (processId as string) : null,
        assessorUserId: user.id,
        assessedAt,
        pilotContext,
        notes,
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/app/s/${siteId}/risk/assessments`);
  }

  const [riskAssessments, workstations, processes] = await Promise.all([
    prisma.riskAssessment.findMany({
      where: { siteId },
      include: {
        workstation: true,
        process: true,
        _count: { select: { findings: true } },
      },
      orderBy: { assessedAt: "desc" },
    }),
    prisma.workstation.findMany({
      where: { siteId },
      orderBy: { name: "asc" },
    }),
    prisma.process.findMany({ where: { siteId }, orderBy: { name: "asc" } }),
  ]);

  const inputClass =
    "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: create form */}
        <section className="flex flex-col gap-3 self-start rounded-lg border border-border bg-surface p-5">
          <h2 className="font-heading text-lg font-bold">
            {dict.createHeading}
          </h2>
          <form
            action={createRiskAssessmentAction}
            className="flex flex-col gap-3"
          >
            <AssessmentSubjectFields
              siteId={siteId}
              workstations={workstations}
              processes={processes}
              labels={{
                subjectTypeLabel: dict.subjectTypeLabel,
                workstationOption: dict.workstationOption,
                processOption: dict.processOption,
                workstationLabel: dict.workstationLabel,
                processLabel: dict.processLabel,
                noWorkstationsHint: dict.noWorkstationsHint,
                noProcessesHint: dict.noProcessesHint,
              }}
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-foreground-muted">
                {dict.assessedAtLabel}
              </span>
              <input
                type="datetime-local"
                name="assessedAt"
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-foreground-muted">
                {dict.pilotContextLabel}
              </span>
              <input name="pilotContext" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium text-foreground-muted">
                {dict.notesLabel}
              </span>
              <input name="notes" className={inputClass} />
            </label>
            <button
              type="submit"
              className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              {dict.create}
            </button>
          </form>
        </section>

        {/* Right: existing assessments */}
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold">
            {dict.existingHeading}
          </h2>
          {riskAssessments.length === 0 ? (
            <p className="text-sm text-border">{dict.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {riskAssessments.map((riskAssessment) => (
                <li key={riskAssessment.id}>
                  <Link
                    href={`/app/s/${siteId}/risk/assessments/${riskAssessment.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3 hover:border-accent"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {riskAssessment.workstation?.name ??
                          riskAssessment.process?.name}
                      </span>
                      <span className="text-xs text-border">
                        {statusLabels[riskAssessment.status]}
                      </span>
                    </span>
                    <span className="text-xs text-border">
                      {riskAssessment.assessedAt.toISOString().slice(0, 10)} ·{" "}
                      {dict.colFindings}: {riskAssessment._count.findings}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
