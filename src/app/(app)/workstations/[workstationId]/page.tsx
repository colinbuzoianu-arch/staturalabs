import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  AddFindingFields,
  type FindingHazardOption,
} from "@/components/add-finding-fields";
import {
  CategoryCheckStatus,
  type HazardCategory,
  type PsychosocialDimension,
  type PsychosocialMethod,
  RiskAssessmentStatus,
} from "@/generated/prisma/enums";
import { requireWorkstationAdministrationAccess } from "@/lib/auth/require-access";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import {
  ALL_HAZARD_CATEGORIES,
  assertCanSubmitForReview,
  CategoryCompletenessError,
  canSubmitForReview,
} from "@/lib/risk/category-check";
import {
  CategoryStatusConflictError,
  createFinding,
  setHazardCategoryStatus,
} from "@/lib/risk/finding";
import { isOtherHazardCode } from "@/lib/risk/hazard-catalog";
import { lookupRiskMatrixCell } from "@/lib/risk/matrix-lookup";
import { createRiskAssessment } from "@/lib/risk/risk-assessment";

const PSYCHOSOCIAL_DIMENSIONS: PsychosocialDimension[] = [
  "TASK_AND_ACTIVITY",
  "WORK_ORGANIZATION",
  "WORK_ENVIRONMENT",
  "SOCIAL_CLIMATE",
];
const PSYCHOSOCIAL_METHODS: PsychosocialMethod[] = [
  "QUESTIONNAIRE",
  "GROUP_DISCUSSION",
  "OBSERVATION",
  "INTERVIEW",
];

function loadActiveDraft(workstationId: string) {
  return prisma.riskAssessment.findFirst({
    where: { workstationId, status: RiskAssessmentStatus.DRAFT },
    orderBy: { assessedAt: "desc" },
    include: {
      categoryChecks: true,
      findings: {
        include: { hazard: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export default async function WorkstationHubPage({
  params,
}: {
  params: Promise<{ workstationId: string }>;
}) {
  const { workstationId } = await params;
  const { workstation } =
    await requireWorkstationAdministrationAccess(workstationId);
  const locale = await getLocale();
  const dashboardDict = getDashboardDictionary(locale);
  const dict = dashboardDict.workstationHub;
  const categoryLabels = dashboardDict.hazardCategoryLabels;

  // --- Server actions (each re-gates and re-resolves the active draft) ---

  async function startAction() {
    "use server";
    const { user, workstation: ws } =
      await requireWorkstationAdministrationAccess(workstationId);
    const existing = await loadActiveDraft(workstationId);
    if (!existing) {
      await createRiskAssessment({
        siteId: ws.siteId,
        workstationId,
        assessorUserId: user.id,
        assessedAt: new Date(),
      });
    }
    revalidatePath(`/workstations/${workstationId}`);
  }

  async function setStatusAction(formData: FormData) {
    "use server";
    const { user } =
      await requireWorkstationAdministrationAccess(workstationId);
    const d = getDashboardDictionary(await getLocale()).workstationHub;
    const draft = await loadActiveDraft(workstationId);
    if (!draft) throw new Error(d.illegalTransition);

    const categoryRaw = formData.get("category");
    if (
      typeof categoryRaw !== "string" ||
      !ALL_HAZARD_CATEGORIES.includes(categoryRaw as HazardCategory)
    ) {
      throw new Error(d.unexpectedError("invalid category"));
    }
    const statusRaw = formData.get("status");
    if (
      statusRaw !== CategoryCheckStatus.NOT_APPLICABLE &&
      statusRaw !== CategoryCheckStatus.CHECKED_NO_HAZARD
    ) {
      throw new Error(d.unexpectedError("invalid status"));
    }
    const rationaleRaw = formData.get("rationale");
    const rationale =
      typeof rationaleRaw === "string" ? rationaleRaw.trim() : "";
    if (rationale.length === 0) {
      throw new Error(d.rationaleRequired);
    }

    try {
      await setHazardCategoryStatus({
        riskAssessmentId: draft.id,
        category: categoryRaw as HazardCategory,
        status: statusRaw,
        rationale,
        checkedByUserId: user.id,
      });
    } catch (error) {
      if (error instanceof CategoryStatusConflictError) {
        throw new Error(d.statusConflict);
      }
      throw error;
    }

    revalidatePath(`/workstations/${workstationId}`);
  }

  async function addFindingAction(formData: FormData) {
    "use server";
    await requireWorkstationAdministrationAccess(workstationId);
    const d = getDashboardDictionary(await getLocale()).workstationHub;
    const draft = await loadActiveDraft(workstationId);
    if (!draft) throw new Error(d.illegalTransition);

    const hazardId = formData.get("hazardId");
    if (typeof hazardId !== "string" || hazardId.length === 0) {
      throw new Error(d.hazardRequired);
    }

    const probabilityRaw = formData.get("probability");
    const probability =
      typeof probabilityRaw === "string"
        ? Number.parseInt(probabilityRaw, 10)
        : NaN;
    if (!Number.isInteger(probability) || probability < 1 || probability > 5) {
      throw new Error(d.probabilityRangeError);
    }

    const severityRaw = formData.get("severity");
    const severity =
      typeof severityRaw === "string" ? Number.parseInt(severityRaw, 10) : NaN;
    if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
      throw new Error(d.severityRangeError);
    }

    const existingControlsRaw = formData.get("existingControls");
    const existingControls =
      typeof existingControlsRaw === "string" &&
      existingControlsRaw.trim().length > 0
        ? existingControlsRaw.trim()
        : null;

    const notesRaw = formData.get("notes");
    const notes =
      typeof notesRaw === "string" && notesRaw.trim().length > 0
        ? notesRaw.trim()
        : null;

    const hazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      select: { category: true, code: true },
    });
    if (!hazard) throw new Error(d.hazardRequired);

    if (isOtherHazardCode(hazard.code) && !notes) {
      throw new Error(d.notesRequiredForOther);
    }

    const cell = await lookupRiskMatrixCell({
      probability,
      severity,
      matrixVersion: draft.matrixVersion,
    });
    if (!cell) throw new Error(d.noMatrixCellError);

    let dimension: PsychosocialDimension | null = null;
    let method: PsychosocialMethod | null = null;
    let groupSize: number | null = null;
    let externalProcedureName: string | null = null;

    if (hazard.category === "PSYCHOSOCIAL") {
      const dimensionRaw = formData.get("dimension");
      if (
        typeof dimensionRaw !== "string" ||
        !PSYCHOSOCIAL_DIMENSIONS.includes(dimensionRaw as PsychosocialDimension)
      ) {
        throw new Error(d.psychosocialDimensionRequired);
      }
      const methodRaw = formData.get("method");
      if (
        typeof methodRaw !== "string" ||
        !PSYCHOSOCIAL_METHODS.includes(methodRaw as PsychosocialMethod)
      ) {
        throw new Error(d.psychosocialMethodRequired);
      }
      const groupSizeRaw = formData.get("groupSize");
      const parsedGroupSize =
        typeof groupSizeRaw === "string"
          ? Number.parseInt(groupSizeRaw, 10)
          : NaN;
      if (!Number.isInteger(parsedGroupSize)) {
        throw new Error(d.psychosocialGroupSizeRequired);
      }
      const externalProcedureNameRaw = formData.get("externalProcedureName");
      dimension = dimensionRaw as PsychosocialDimension;
      method = methodRaw as PsychosocialMethod;
      groupSize = parsedGroupSize;
      externalProcedureName =
        typeof externalProcedureNameRaw === "string" &&
        externalProcedureNameRaw.trim().length > 0
          ? externalProcedureNameRaw.trim()
          : null;
    }

    try {
      await createFinding({
        riskAssessmentId: draft.id,
        hazardId,
        category: hazard.category,
        probability,
        severity,
        riskScore: cell.riskScore,
        riskBand: cell.riskBand,
        existingControls,
        notes,
        dimension,
        method,
        groupSize,
        externalProcedureName,
      });
    } catch (error) {
      throw new Error(
        d.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/workstations/${workstationId}`);
  }

  async function submitAction() {
    "use server";
    await requireWorkstationAdministrationAccess(workstationId);
    const d = getDashboardDictionary(await getLocale()).workstationHub;
    const labels = getDashboardDictionary(
      await getLocale(),
    ).hazardCategoryLabels;
    const draft = await loadActiveDraft(workstationId);
    if (!draft || draft.status !== RiskAssessmentStatus.DRAFT) {
      throw new Error(d.illegalTransition);
    }
    try {
      await assertCanSubmitForReview(draft.id);
    } catch (error) {
      if (error instanceof CategoryCompletenessError) {
        const blocking = [
          ...error.openCategories,
          ...error.inconsistentCategories,
        ].map((category) => labels[category]);
        throw new Error(d.reviewBlocked(blocking.join(", ")));
      }
      throw error;
    }
    await prisma.riskAssessment.update({
      where: { id: draft.id },
      data: { status: RiskAssessmentStatus.IN_REVIEW },
    });
    revalidatePath(`/workstations/${workstationId}`);
  }

  // --- Page data ---

  const draft = await loadActiveDraft(workstationId);
  const [systemHazards, companyHazards, tasks] = await Promise.all([
    prisma.hazard.findMany({
      where: { companyId: null },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
    prisma.hazard.findMany({
      where: { companyId: workstation.site.companyId },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
    prisma.task.findMany({
      where: { workstationId },
      orderBy: { name: "asc" },
    }),
  ]);

  const hazardsByCategory = new Map<HazardCategory, FindingHazardOption[]>();
  for (const hazard of [...systemHazards, ...companyHazards]) {
    const option: FindingHazardOption = {
      id: hazard.id,
      category: hazard.category,
      label: hazard.name,
    };
    const list = hazardsByCategory.get(hazard.category);
    if (list) list.push(option);
    else hazardsByCategory.set(hazard.category, [option]);
  }

  const statusByCategory = new Map(
    (draft?.categoryChecks ?? []).map((check) => [
      check.category,
      check.status,
    ]),
  );
  type DraftFinding = NonNullable<
    Awaited<ReturnType<typeof loadActiveDraft>>
  >["findings"][number];
  const findingsByCategory = new Map<HazardCategory, DraftFinding[]>();
  if (draft) {
    for (const finding of draft.findings) {
      const list = findingsByCategory.get(finding.hazard.category);
      if (list) list.push(finding);
      else findingsByCategory.set(finding.hazard.category, [finding]);
    }
  }

  const assessedCount = ALL_HAZARD_CATEGORIES.filter(
    (category) =>
      (statusByCategory.get(category) ?? CategoryCheckStatus.OPEN) !==
      CategoryCheckStatus.OPEN,
  ).length;
  const completeness = draft
    ? canSubmitForReview(
        draft.categoryChecks.map((c) => ({
          category: c.category,
          status: c.status,
        })),
        draft.findings.map((f) => f.hazard.category),
      )
    : null;
  const blockingNames =
    completeness && !completeness.ok
      ? [...completeness.openCategories, ...completeness.inconsistentCategories]
          .map((category) => categoryLabels[category])
          .join(", ")
      : "";

  const psychosocialLabels = {
    hazardLabel: dict.hazardLabel,
    dimensionLabel: dict.psychosocialDimensionLabel,
    dimensionOptions: dict.psychosocialDimensionLabels,
    methodLabel: dict.psychosocialMethodLabel,
    methodOptions: dict.psychosocialMethodLabels,
    groupSizeLabel: dict.psychosocialGroupSizeLabel,
    groupSizeQuestionnaireHint: dict.psychosocialGroupSizeQuestionnaireHint,
    externalProcedureNameLabel: dict.psychosocialExternalProcedureNameLabel,
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <p className="text-sm text-border">
        <Link href="/sites" className="hover:text-accent">
          {dict.breadcrumbSites}
        </Link>{" "}
        /{" "}
        <Link
          href={`/sites/${workstation.site.id}`}
          className="hover:text-accent"
        >
          {workstation.site.name}
        </Link>{" "}
        / {workstation.name}
      </p>

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{workstation.name}</h1>
        <p className="text-sm text-border">{dict.description}</p>
        <div className="flex flex-wrap gap-4 pt-1 text-sm">
          <Link
            href={`/workstations/${workstation.id}/risk`}
            className="text-accent hover:underline"
          >
            {dict.riskAnalysisLink}
          </Link>
          {draft && (
            <Link
              href={`/administration/risk-assessments/${draft.id}`}
              className="text-accent hover:underline"
            >
              {dict.openDetailLink}
            </Link>
          )}
        </div>
      </div>

      {!draft ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
          <h2 className="font-heading text-lg font-bold">
            {dict.noDraftHeading}
          </h2>
          <p className="text-sm text-border">{dict.noDraftDescription}</p>
          <form action={startAction}>
            <button
              type="submit"
              className="self-start rounded bg-accent px-4 py-2 text-sm font-semibold text-background"
            >
              {dict.startEvaluation}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-lg font-bold">
                {dict.draftHeading}
              </h2>
              <span className="text-sm text-border">
                {dict.assessedAtLabel} {draft.assessedAt.toISOString()}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-background"
              aria-hidden
            >
              <div
                className="h-full bg-accent"
                style={{
                  width: `${(assessedCount / ALL_HAZARD_CATEGORIES.length) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm">
              {dict.progress(assessedCount, ALL_HAZARD_CATEGORIES.length)}
            </p>
            {draft.status === RiskAssessmentStatus.DRAFT ? (
              completeness?.ok ? (
                <form action={submitAction}>
                  <p className="pb-2 text-sm text-border">
                    {dict.progressComplete}
                  </p>
                  <button
                    type="submit"
                    className="self-start rounded bg-accent px-4 py-2 text-sm font-semibold text-background"
                  >
                    {dict.submitForReview}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-border">
                    {dict.reviewBlocked(blockingNames)}
                  </p>
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed self-start rounded border border-border px-4 py-2 text-sm text-border opacity-60"
                  >
                    {dict.submitForReview}
                  </button>
                </div>
              )
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{dict.submittedHeading}</p>
                <p className="text-sm text-border">
                  {dict.submittedDescription}
                </p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            {ALL_HAZARD_CATEGORIES.map((category) => {
              const status =
                statusByCategory.get(category) ?? CategoryCheckStatus.OPEN;
              const categoryFindings = findingsByCategory.get(category) ?? [];
              const categoryHazards = hazardsByCategory.get(category) ?? [];
              const isErgonomic = category === "ERGONOMIC_MSD";
              return (
                <details
                  key={category}
                  className="rounded-lg border border-border bg-surface"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
                    <span className="font-semibold">
                      {categoryLabels[category]}
                    </span>
                    <StatusChip
                      status={status}
                      label={dict.categoryStatusLabels[status]}
                    />
                  </summary>

                  <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
                    {categoryFindings.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">
                          {dict.findingsHeading}
                        </h3>
                        <ul className="flex flex-col gap-2 text-sm">
                          {categoryFindings.map((finding) => (
                            <li
                              key={finding.id}
                              className="rounded border border-border bg-background p-3"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium">
                                  {finding.hazard.name}
                                </span>
                                <span className="text-border">
                                  {dict.riskLabel} {finding.riskScore}
                                </span>
                              </div>
                              {finding.notes && (
                                <p className="text-border">{finding.notes}</p>
                              )}
                              <Link
                                href={`/administration/sites/${workstation.site.id}/actions?fromFindingId=${finding.id}`}
                                className="text-accent hover:underline"
                              >
                                {dict.raiseAction}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isErgonomic && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">
                          {dict.tasksHeading}
                        </h3>
                        <p className="text-xs text-border">
                          {dict.tasksDescription}
                        </p>
                        {tasks.length === 0 ? (
                          <p className="text-sm text-border">
                            {dict.tasksEmpty}
                          </p>
                        ) : (
                          <ul className="flex flex-wrap gap-2">
                            {tasks.map((task) => (
                              <li key={task.id}>
                                <Link
                                  href={`/tasks/${task.id}`}
                                  className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
                                >
                                  {task.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Record a hazard (finding) */}
                    {categoryHazards.length > 0 && (
                      <form
                        action={addFindingAction}
                        className="flex flex-col gap-3 rounded border border-border bg-background p-3"
                      >
                        <h3 className="text-sm font-semibold">
                          {dict.addFindingHeading}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <AddFindingFields
                            hazards={categoryHazards}
                            labels={psychosocialLabels}
                          />
                          <label className="flex flex-col gap-1 text-sm">
                            {dict.probabilityLabel}
                            <input
                              type="number"
                              name="probability"
                              min={1}
                              max={5}
                              required
                              className="w-20 rounded border border-border bg-surface px-2 py-1"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            {dict.severityLabel}
                            <input
                              type="number"
                              name="severity"
                              min={1}
                              max={5}
                              required
                              className="w-20 rounded border border-border bg-surface px-2 py-1"
                            />
                          </label>
                        </div>
                        <label className="flex flex-col gap-1 text-sm">
                          {dict.existingControlsLabel}
                          <input
                            name="existingControls"
                            className="rounded border border-border bg-surface px-2 py-1"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          {dict.notesLabel}
                          <input
                            name="notes"
                            className="rounded border border-border bg-surface px-2 py-1"
                          />
                        </label>
                        <button
                          type="submit"
                          className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
                        >
                          {dict.addFinding}
                        </button>
                      </form>
                    )}

                    {/* No hazard here? — record a status (only when no finding yet) */}
                    {categoryFindings.length === 0 && (
                      <form
                        action={setStatusAction}
                        className="flex flex-col gap-3 rounded border border-border bg-background p-3"
                      >
                        <h3 className="text-sm font-semibold">
                          {dict.setStatusHeading}
                        </h3>
                        <input type="hidden" name="category" value={category} />
                        <label className="flex flex-col gap-1 text-sm">
                          {dict.statusChoiceLabel}
                          <select
                            name="status"
                            className="rounded border border-border bg-surface px-2 py-1"
                          >
                            <option
                              value={CategoryCheckStatus.CHECKED_NO_HAZARD}
                            >
                              {dict.markCheckedNoHazard}
                            </option>
                            <option value={CategoryCheckStatus.NOT_APPLICABLE}>
                              {dict.markNotApplicable}
                            </option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          {dict.rationaleLabel}
                          <input
                            name="rationale"
                            required
                            className="rounded border border-border bg-surface px-2 py-1"
                          />
                        </label>
                        <button
                          type="submit"
                          className="self-start rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
                        >
                          {dict.saveStatus}
                        </button>
                      </form>
                    )}
                  </div>
                </details>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

function StatusChip({
  status,
  label,
}: {
  status: CategoryCheckStatus;
  label: string;
}) {
  const className =
    status === CategoryCheckStatus.OPEN
      ? "border-coral text-coral"
      : status === CategoryCheckStatus.HAZARD_PRESENT
        ? "border-accent text-accent"
        : "border-border text-border";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}
