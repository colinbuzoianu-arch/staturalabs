import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionStatus, VerificationOutcome } from "@/generated/prisma/enums";
import { ACTION_STATUS_TRANSITIONS, transitionAction } from "@/lib/action";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const VERIFICATION_OUTCOMES = Object.values(VerificationOutcome);

async function loadAction(actionId: string) {
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    include: {
      riskFinding: { include: { hazard: true } },
      assessmentSession: { include: { workstation: true } },
      statusEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!action) notFound();
  return action;
}

// Resource-first access, same pattern as the risk-assessment detail page:
// an Action doesn't carry siteId in its URL, so fetch it, then gate on its
// own siteId — never confirms existence to a tenant that can't see it.
export default async function ActionDetailPage({
  params,
}: {
  params: Promise<{ actionId: string }>;
}) {
  const { actionId } = await params;
  const initial = await loadAction(actionId);
  const { site } = await requireSiteAdministrationAccess(initial.siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).actionDetailPage;
  const commonDict = getAdministrationDictionary(locale).common;
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;
  const hierarchyLabels =
    getAdministrationDictionary(locale).hierarchyOfControlLabels;
  const verificationOutcomeLabels =
    getAdministrationDictionary(locale).verificationOutcomeLabels;

  async function transitionActionAction(formData: FormData) {
    "use server";
    const current = await loadAction(actionId);
    const { user, site: currentSite } = await requireSiteAdministrationAccess(
      current.siteId,
    );
    const dict = getAdministrationDictionary(
      await getLocale(),
    ).actionDetailPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const toStatusRaw = formData.get("toStatus");
    if (
      typeof toStatusRaw !== "string" ||
      !(Object.values(ActionStatus) as string[]).includes(toStatusRaw)
    ) {
      throw new Error(dict.toStatusRequired);
    }
    const toStatus = toStatusRaw as ActionStatus;

    const noteRaw = formData.get("note");
    const note =
      typeof noteRaw === "string" && noteRaw.trim().length > 0
        ? noteRaw.trim()
        : null;

    let verificationOutcome: VerificationOutcome | null = null;
    let verificationAssessmentId: string | null = null;

    if (toStatus === ActionStatus.VERIFIED) {
      const outcomeRaw = formData.get("verificationOutcome");
      if (
        typeof outcomeRaw !== "string" ||
        !(VERIFICATION_OUTCOMES as string[]).includes(outcomeRaw)
      ) {
        throw new Error(dict.verificationOutcomeRequired);
      }
      verificationOutcome = outcomeRaw as VerificationOutcome;

      const assessmentIdRaw = formData.get("verificationAssessmentId");
      verificationAssessmentId =
        typeof assessmentIdRaw === "string" && assessmentIdRaw.length > 0
          ? assessmentIdRaw
          : null;

      if (!verificationAssessmentId && !note) {
        throw new Error(dict.verificationEvidenceRequired);
      }
    }

    try {
      await transitionAction({
        actionId,
        toStatus,
        byUserId: user.id,
        note,
        verificationOutcome,
        verificationAssessmentId,
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/administration/actions/${actionId}`);
    revalidatePath(`/administration/sites/${currentSite.id}/actions`);
  }

  const availableTransitions = ACTION_STATUS_TRANSITIONS[initial.status];

  const [riskAssessments, platformUsers] = await Promise.all([
    prisma.riskAssessment.findMany({
      where: { siteId: initial.siteId },
      include: { workstation: true, process: true },
      orderBy: { assessedAt: "desc" },
    }),
    prisma.platformUser.findMany({ where: { companyId: site.companyId } }),
  ]);

  const responsibleUser = initial.responsibleUserId
    ? platformUsers.find((u) => u.id === initial.responsibleUserId)
    : null;

  const sourceLabel = initial.riskFinding
    ? initial.riskFinding.hazard.name
    : initial.assessmentSession
      ? `${initial.assessmentSession.workstation.name} — ${initial.assessmentSession.startedAt.toISOString()}`
      : commonDict.none;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <p className="text-sm text-border">
        <Link
          href={`/administration/sites/${site.id}/actions`}
          className="hover:text-accent"
        >
          {dict.breadcrumbActions}
        </Link>{" "}
        / {initial.title}
      </p>

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{initial.title}</h1>
        {initial.description && (
          <p className="text-sm text-border">{initial.description}</p>
        )}
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-border">
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.statusLabel}</dt>
            <dd>{statusLabels[initial.status]}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.sourceLabel}</dt>
            <dd>{sourceLabel}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.responsibleLabel}</dt>
            <dd>
              {responsibleUser?.name ??
                initial.responsibleRoleLabel ??
                commonDict.none}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.dueDateLabel}</dt>
            <dd>
              {initial.dueDate
                ? initial.dueDate.toISOString().slice(0, 10)
                : commonDict.none}
            </dd>
          </div>
          {initial.hierarchyOfControl && (
            <div className="flex gap-1">
              <dt className="font-semibold">{dict.hierarchyLabel}</dt>
              <dd>{hierarchyLabels[initial.hierarchyOfControl]}</dd>
            </div>
          )}
        </dl>
      </div>

      {availableTransitions.length === 0 ? (
        <p className="text-sm text-border">{dict.noTransitionsAvailable}</p>
      ) : (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-heading text-lg font-bold">
            {dict.transitionHeading}
          </h2>
          <form action={transitionActionAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {dict.toStatusLabel}
              <select
                name="toStatus"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {availableTransitions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {dict.noteLabel}
              <input
                name="note"
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>

            {availableTransitions.includes(ActionStatus.VERIFIED) && (
              <fieldset className="flex flex-col gap-2 rounded border border-border p-3">
                <legend className="px-1 text-sm font-semibold">
                  {dict.verifyHeading}
                </legend>
                <label className="flex flex-col gap-1 text-sm">
                  {dict.verificationOutcomeLabel}
                  <select
                    name="verificationOutcome"
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="">{commonDict.none}</option>
                    {VERIFICATION_OUTCOMES.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {verificationOutcomeLabels[outcome]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  {dict.verificationAssessmentLabel}
                  <select
                    name="verificationAssessmentId"
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="">{commonDict.none}</option>
                    {riskAssessments.map((riskAssessment) => (
                      <option key={riskAssessment.id} value={riskAssessment.id}>
                        {riskAssessment.workstation?.name ??
                          riskAssessment.process?.name}{" "}
                        — {riskAssessment.assessedAt.toISOString()}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-border">
                  {dict.verificationNoteLabel}
                </p>
              </fieldset>
            )}

            <button
              type="submit"
              className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
            >
              {dict.transition}
            </button>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-bold">
          {dict.statusEventsHeading}
        </h2>
        {initial.statusEvents.length === 0 ? (
          <p className="text-sm text-border">{dict.statusEventsEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {initial.statusEvents.map((event) => (
              <li key={event.id} className="text-border">
                {event.fromStatus
                  ? statusLabels[event.fromStatus]
                  : commonDict.none}
                {" -> "}
                {statusLabels[event.toStatus]} — {event.createdAt.toISOString()}
                {event.note && ` — ${event.note}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
