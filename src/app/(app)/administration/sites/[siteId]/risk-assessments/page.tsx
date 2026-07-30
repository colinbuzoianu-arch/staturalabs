import { revalidatePath } from "next/cache";
import Link from "next/link";
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

    revalidatePath(`/administration/sites/${siteId}/risk-assessments`);
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">{dict.createHeading}</h2>
        <form
          action={createRiskAssessmentAction}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="subjectType"
                value="workstation"
                defaultChecked
              />
              {dict.workstationOption}
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="subjectType" value="process" />
              {dict.processOption}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {dict.workstationLabel}
              <select
                name="workstationId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {workstations.map((workstation) => (
                  <option key={workstation.id} value={workstation.id}>
                    {workstation.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.processLabel}
              <select
                name="processId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.assessedAtLabel}
              <input
                type="datetime-local"
                name="assessedAt"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            {dict.pilotContextLabel}
            <input
              name="pilotContext"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.notesLabel}
            <input
              name="notes"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
          >
            {dict.create}
          </button>
        </form>
      </section>

      {riskAssessments.length === 0 ? (
        <p className="text-sm text-border">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-4">{dict.colSubject}</th>
              <th className="py-1 pr-4">{dict.colStatus}</th>
              <th className="py-1 pr-4">{dict.colAssessedAt}</th>
              <th className="py-1 pr-4">{dict.colFindings}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {riskAssessments.map((riskAssessment) => (
              <tr
                key={riskAssessment.id}
                className="border-b border-border last:border-0"
              >
                <td className="py-1 pr-4">
                  {riskAssessment.workstation?.name ??
                    riskAssessment.process?.name}
                </td>
                <td className="py-1 pr-4">
                  {statusLabels[riskAssessment.status]}
                </td>
                <td className="py-1 pr-4">
                  {riskAssessment.assessedAt.toISOString()}
                </td>
                <td className="py-1 pr-4">{riskAssessment._count.findings}</td>
                <td className="py-1">
                  <Link
                    href={`/administration/risk-assessments/${riskAssessment.id}`}
                    className="underline hover:text-accent"
                  >
                    {dict.viewLink}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
