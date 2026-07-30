import { revalidatePath } from "next/cache";
import Link from "next/link";
import { HierarchyOfControl } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const HIERARCHY_OPTIONS = Object.values(HierarchyOfControl);

export default async function ActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ fromFindingId?: string }>;
}) {
  const { siteId } = await params;
  const { fromFindingId } = await searchParams;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).actionsPage;
  const commonDict = getAdministrationDictionary(locale).common;
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;
  const hierarchyLabels =
    getAdministrationDictionary(locale).hierarchyOfControlLabels;

  async function createActionAction(formData: FormData) {
    "use server";
    const { site } = await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(await getLocale()).actionsPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const sourceType = formData.get("sourceType");
    const riskFindingIdRaw = formData.get("riskFindingId");
    const assessmentSessionIdRaw = formData.get("assessmentSessionId");

    const isFinding =
      sourceType === "finding" &&
      typeof riskFindingIdRaw === "string" &&
      riskFindingIdRaw.length > 0;
    const isSession =
      sourceType === "session" &&
      typeof assessmentSessionIdRaw === "string" &&
      assessmentSessionIdRaw.length > 0;

    if (!isFinding && !isSession) {
      throw new Error(dict.sourceRequired);
    }

    const title = formData.get("title");
    if (typeof title !== "string" || title.trim().length === 0) {
      throw new Error(dict.titleRequired);
    }

    const descriptionRaw = formData.get("description");
    const description =
      typeof descriptionRaw === "string" && descriptionRaw.trim().length > 0
        ? descriptionRaw.trim()
        : null;

    const hierarchyRaw = formData.get("hierarchyOfControl");
    const hierarchyOfControl =
      typeof hierarchyRaw === "string" &&
      (HIERARCHY_OPTIONS as string[]).includes(hierarchyRaw)
        ? (hierarchyRaw as HierarchyOfControl)
        : null;

    const responsibleUserIdRaw = formData.get("responsibleUserId");
    const responsibleUserId =
      typeof responsibleUserIdRaw === "string" &&
      responsibleUserIdRaw.length > 0
        ? responsibleUserIdRaw
        : null;

    const responsibleRoleLabelRaw = formData.get("responsibleRoleLabel");
    const responsibleRoleLabel =
      !responsibleUserId &&
      typeof responsibleRoleLabelRaw === "string" &&
      responsibleRoleLabelRaw.trim().length > 0
        ? responsibleRoleLabelRaw.trim()
        : null;

    const dueDateRaw = formData.get("dueDate");
    const dueDate =
      typeof dueDateRaw === "string" && dueDateRaw.trim().length > 0
        ? new Date(dueDateRaw)
        : null;

    try {
      await prisma.action.create({
        data: {
          siteId,
          riskFindingId: isFinding ? (riskFindingIdRaw as string) : null,
          assessmentSessionId: isSession
            ? (assessmentSessionIdRaw as string)
            : null,
          title: title.trim(),
          description,
          hierarchyOfControl,
          responsibleUserId,
          responsibleRoleLabel,
          dueDate,
        },
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/administration/sites/${site.id}/actions`);
  }

  const [actions, findings, sessions, platformUsers] = await Promise.all([
    prisma.action.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.riskFinding.findMany({
      where: { riskAssessment: { siteId } },
      include: {
        hazard: true,
        riskAssessment: { include: { workstation: true, process: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assessmentSession.findMany({
      where: { workstation: { siteId } },
      include: { workstation: true },
      orderBy: { startedAt: "desc" },
    }),
    prisma.platformUser.findMany({ where: { companyId: site.companyId } }),
  ]);

  const now = new Date();

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
          action={createActionAction}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="sourceType"
                value="finding"
                defaultChecked={!!fromFindingId}
              />
              {dict.fromFindingOption}
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="sourceType"
                value="session"
                defaultChecked={!fromFindingId}
              />
              {dict.fromSessionOption}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {dict.findingLabel}
              <select
                name="riskFindingId"
                defaultValue={fromFindingId ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{commonDict.none}</option>
                {findings.map((finding) => (
                  <option key={finding.id} value={finding.id}>
                    {finding.riskAssessment.workstation?.name ??
                      finding.riskAssessment.process?.name}{" "}
                    — {finding.hazard.name} ({finding.riskBand})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.sessionLabel}
              <select
                name="assessmentSessionId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{commonDict.none}</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.workstation.name} —{" "}
                    {session.startedAt.toISOString()}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            {dict.titleLabel}
            <input
              name="title"
              required
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {dict.descriptionLabel}
            <input
              name="description"
              className="rounded border border-border bg-background px-2 py-1"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {dict.hierarchyLabel}
              <select
                name="hierarchyOfControl"
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{commonDict.none}</option>
                {HIERARCHY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {hierarchyLabels[option]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.responsibleUserLabel}
              <select
                name="responsibleUserId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{commonDict.none}</option>
                {platformUsers.map((platformUser) => (
                  <option key={platformUser.id} value={platformUser.id}>
                    {platformUser.name} ({platformUser.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.responsibleRoleLabel}
              <input
                name="responsibleRoleLabel"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.dueDateLabel}
              <input
                type="date"
                name="dueDate"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <button
            type="submit"
            className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
          >
            {dict.create}
          </button>
        </form>
      </section>

      {actions.length === 0 ? (
        <p className="text-sm text-border">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1 pr-4">{dict.colTitle}</th>
              <th className="py-1 pr-4">{dict.colStatus}</th>
              <th className="py-1 pr-4">{dict.colDue}</th>
              <th className="py-1 pr-4">{dict.colResponsible}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => {
              const isOverdue =
                action.dueDate !== null &&
                action.dueDate < now &&
                action.status !== "VERIFIED" &&
                action.status !== "CANCELLED";
              return (
                <tr
                  key={action.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-1 pr-4">{action.title}</td>
                  <td className="py-1 pr-4">{statusLabels[action.status]}</td>
                  <td className={`py-1 pr-4 ${isOverdue ? "text-coral" : ""}`}>
                    {action.dueDate
                      ? action.dueDate.toISOString().slice(0, 10)
                      : commonDict.none}
                  </td>
                  <td className="py-1 pr-4">
                    {action.responsibleRoleLabel ?? commonDict.none}
                  </td>
                  <td className="py-1">
                    <Link
                      href={`/administration/actions/${action.id}`}
                      className="underline hover:text-accent"
                    >
                      {dict.viewLink}
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
