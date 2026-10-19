import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryCheckStatus,
  type EnvironmentalAspectCategory,
  type OperatingCondition,
  RiskAssessmentStatus,
} from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import {
  ALL_ENVIRONMENTAL_CATEGORIES,
  assertCanSubmitForReview,
  CategoryCompletenessError,
  canSubmitForReview,
} from "@/lib/env/environmental-category-check";
import {
  CategoryStatusConflictError,
  createEnvironmentalFinding,
  setEnvironmentalCategoryStatus,
} from "@/lib/env/environmental-finding";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { lookupRiskMatrixCell } from "@/lib/risk/matrix-lookup";

const OPERATING_CONDITIONS: OperatingCondition[] = [
  "NORMAL",
  "ABNORMAL",
  "EMERGENCY",
];

function loadAssessment(id: string) {
  return prisma.environmentalAssessment.findUnique({
    where: { id },
    include: {
      workstation: true,
      categoryChecks: true,
      findings: {
        include: {
          aspect: true,
          quantities: { orderBy: { periodEnd: "desc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// E3 (§5.4): the working surface for one environmental assessment — the
// 14-aspect-category completeness checklist (same pattern as the OSH
// workstation hub), inline finding + status + quantity forms, and the
// completeness-gated DRAFT→IN_REVIEW→APPROVED flow. Resource-first gate:
// fetch, then requireSiteAdministrationAccess on its own siteId (same
// fail-closed 404-not-redirect pattern as the OSH risk-assessment detail).
export default async function EnvironmentalAssessmentDetailPage({
  params,
}: {
  params: Promise<{ environmentalAssessmentId: string }>;
}) {
  const { environmentalAssessmentId } = await params;
  const initial = await loadAssessment(environmentalAssessmentId);
  if (!initial) notFound();
  const { site } = await requireSiteAdministrationAccess(initial.siteId);
  const locale = await getLocale();
  const administrationDict = getAdministrationDictionary(locale);
  const dict = administrationDict.environment;
  const statusLabels = administrationDict.riskAssessmentStatusLabels;
  const riskBandLabels = getCommonDictionary(locale).riskBandLabels;

  async function submitForReviewAction() {
    "use server";
    const current = await loadAssessment(environmentalAssessmentId);
    if (!current) notFound();
    await requireSiteAdministrationAccess(current.siteId);
    const administrationDict = getAdministrationDictionary(await getLocale());
    const d = administrationDict.environment;
    if (current.status !== RiskAssessmentStatus.DRAFT) {
      throw new Error(d.illegalTransition);
    }
    try {
      await assertCanSubmitForReview(environmentalAssessmentId);
    } catch (error) {
      if (error instanceof CategoryCompletenessError) {
        const labels = d.aspectCategoryLabels;
        const blocking = [
          ...error.openCategories,
          ...error.inconsistentCategories,
        ].map((category) => labels[category]);
        throw new Error(d.reviewBlocked(blocking.join(", ")));
      }
      throw error;
    }
    await prisma.environmentalAssessment.update({
      where: { id: environmentalAssessmentId },
      data: { status: RiskAssessmentStatus.IN_REVIEW },
    });
    revalidatePath(
      `/administration/environmental-assessments/${environmentalAssessmentId}`,
    );
  }

  async function approveAction() {
    "use server";
    const current = await loadAssessment(environmentalAssessmentId);
    if (!current) notFound();
    const { user } = await requireSiteAdministrationAccess(current.siteId);
    const d = getAdministrationDictionary(await getLocale()).environment;
    if (current.status !== RiskAssessmentStatus.IN_REVIEW) {
      throw new Error(d.illegalTransition);
    }
    await prisma.environmentalAssessment.update({
      where: { id: environmentalAssessmentId },
      data: {
        status: RiskAssessmentStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
      },
    });
    revalidatePath(
      `/administration/environmental-assessments/${environmentalAssessmentId}`,
    );
  }

  async function setStatusAction(formData: FormData) {
    "use server";
    const current = await loadAssessment(environmentalAssessmentId);
    if (!current) notFound();
    const { user } = await requireSiteAdministrationAccess(current.siteId);
    const d = getAdministrationDictionary(await getLocale()).environment;

    const categoryRaw = formData.get("category");
    if (
      typeof categoryRaw !== "string" ||
      !ALL_ENVIRONMENTAL_CATEGORIES.includes(
        categoryRaw as EnvironmentalAspectCategory,
      )
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
    if (rationale.length === 0) throw new Error(d.rationaleRequired);

    try {
      await setEnvironmentalCategoryStatus({
        environmentalAssessmentId,
        category: categoryRaw as EnvironmentalAspectCategory,
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
    revalidatePath(
      `/administration/environmental-assessments/${environmentalAssessmentId}`,
    );
  }

  async function addFindingAction(formData: FormData) {
    "use server";
    const current = await loadAssessment(environmentalAssessmentId);
    if (!current) notFound();
    await requireSiteAdministrationAccess(current.siteId);
    const d = getAdministrationDictionary(await getLocale()).environment;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const aspectId = formData.get("aspectId");
    if (typeof aspectId !== "string" || aspectId.length === 0) {
      throw new Error(d.aspectRequired);
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
    const operatingConditionRaw = formData.get("operatingCondition");
    if (
      typeof operatingConditionRaw !== "string" ||
      !OPERATING_CONDITIONS.includes(
        operatingConditionRaw as OperatingCondition,
      )
    ) {
      throw new Error(d.unexpectedError("invalid operating condition"));
    }
    const legallyRelevant = formData.get("legallyRelevant") === "on";
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

    const aspect = await prisma.environmentalAspect.findUnique({
      where: { id: aspectId },
      select: { category: true },
    });
    if (!aspect) throw new Error(d.aspectRequired);

    const cell = await lookupRiskMatrixCell({
      probability,
      severity,
      matrixVersion: current.matrixVersion,
    });
    if (!cell) throw new Error(d.noMatrixCellError);

    try {
      await createEnvironmentalFinding({
        environmentalAssessmentId,
        environmentalAspectId: aspectId,
        category: aspect.category,
        probability,
        severity,
        riskScore: cell.riskScore,
        riskBand: cell.riskBand,
        operatingCondition: operatingConditionRaw as OperatingCondition,
        legallyRelevant,
        existingControls,
        notes,
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
    revalidatePath(
      `/administration/environmental-assessments/${environmentalAssessmentId}`,
    );
  }

  async function addQuantityAction(formData: FormData) {
    "use server";
    const current = await loadAssessment(environmentalAssessmentId);
    if (!current) notFound();
    await requireSiteAdministrationAccess(current.siteId);
    const d = getAdministrationDictionary(await getLocale()).environment;

    const findingId = formData.get("environmentalFindingId");
    if (typeof findingId !== "string" || findingId.length === 0) {
      throw new Error(d.unexpectedError("missing finding"));
    }
    // Guard the finding belongs to this assessment (the action runs on its
    // own; don't trust the form's id blindly).
    const owns = current.findings.some((f) => f.id === findingId);
    if (!owns) throw new Error(d.unexpectedError("unknown finding"));

    const valueRaw = formData.get("value");
    const value =
      typeof valueRaw === "string" ? Number.parseFloat(valueRaw) : NaN;
    if (Number.isNaN(value)) throw new Error(d.valueRequired);
    const unitRaw = formData.get("unit");
    if (typeof unitRaw !== "string" || unitRaw.trim().length === 0) {
      throw new Error(d.unexpectedError("unit required"));
    }
    const periodStartRaw = formData.get("periodStart");
    const periodEndRaw = formData.get("periodEnd");
    if (
      typeof periodStartRaw !== "string" ||
      typeof periodEndRaw !== "string" ||
      periodStartRaw.trim() === "" ||
      periodEndRaw.trim() === ""
    ) {
      throw new Error(d.periodRequired);
    }
    const periodStart = new Date(periodStartRaw);
    const periodEnd = new Date(periodEndRaw);
    if (
      Number.isNaN(periodStart.getTime()) ||
      Number.isNaN(periodEnd.getTime())
    ) {
      throw new Error(d.periodRequired);
    }
    const sourceRaw = formData.get("source");
    if (typeof sourceRaw !== "string" || sourceRaw.trim().length === 0) {
      throw new Error(d.sourceRequired);
    }
    const isEstimate = formData.get("isEstimate") === "on";
    const notesRaw = formData.get("quantityNotes");
    const notes =
      typeof notesRaw === "string" && notesRaw.trim().length > 0
        ? notesRaw.trim()
        : null;

    await prisma.environmentalQuantity.create({
      data: {
        environmentalFindingId: findingId,
        value,
        unit: unitRaw.trim(),
        periodStart,
        periodEnd,
        source: sourceRaw.trim(),
        isEstimate,
        notes,
      },
    });
    revalidatePath(
      `/administration/environmental-assessments/${environmentalAssessmentId}`,
    );
  }

  const [systemAspects, companyAspects] = await Promise.all([
    prisma.environmentalAspect.findMany({
      where: { companyId: null },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
    prisma.environmentalAspect.findMany({
      where: { companyId: site.companyId },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
  ]);
  const aspectsByCategory = new Map<
    EnvironmentalAspectCategory,
    { id: string; name: string }[]
  >();
  for (const aspect of [...systemAspects, ...companyAspects]) {
    const list = aspectsByCategory.get(aspect.category) ?? [];
    list.push({ id: aspect.id, name: aspect.name });
    aspectsByCategory.set(aspect.category, list);
  }

  const statusByCategory = new Map(
    initial.categoryChecks.map((c) => [c.category, c.status]),
  );
  type EnvFinding = (typeof initial.findings)[number];
  const findingsByCategory = new Map<
    EnvironmentalAspectCategory,
    EnvFinding[]
  >();
  for (const finding of initial.findings) {
    const list = findingsByCategory.get(finding.aspect.category) ?? [];
    list.push(finding);
    findingsByCategory.set(finding.aspect.category, list);
  }

  const assessedCount = ALL_ENVIRONMENTAL_CATEGORIES.filter(
    (category) =>
      (statusByCategory.get(category) ?? CategoryCheckStatus.OPEN) !==
      CategoryCheckStatus.OPEN,
  ).length;
  const completeness = canSubmitForReview(
    initial.categoryChecks.map((c) => ({
      category: c.category,
      status: c.status,
    })),
    initial.findings.map((f) => f.aspect.category),
  );
  const blockingNames =
    completeness.ok === false
      ? [...completeness.openCategories, ...completeness.inconsistentCategories]
          .map((category) => dict.aspectCategoryLabels[category])
          .join(", ")
      : "";

  const subjectName = initial.workstation?.name ?? dict.scopeSiteLevel;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <p className="text-sm text-border">
        <Link
          href={`/administration/sites/${site.id}/environment`}
          className="hover:text-accent"
        >
          {dict.breadcrumb}
        </Link>{" "}
        / {subjectName}
      </p>

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.detailEyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{subjectName}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-border">
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.statusLabel}</dt>
            <dd>{statusLabels[initial.status]}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.matrixVersionLabel}</dt>
            <dd>{initial.matrixVersion}</dd>
          </div>
        </dl>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-background"
          aria-hidden
        >
          <div
            className="h-full bg-accent"
            style={{
              width: `${(assessedCount / ALL_ENVIRONMENTAL_CATEGORIES.length) * 100}%`,
            }}
          />
        </div>
        <p className="text-sm">
          {dict.progress(assessedCount, ALL_ENVIRONMENTAL_CATEGORIES.length)}
        </p>
        {initial.status === RiskAssessmentStatus.DRAFT &&
          (completeness.ok ? (
            <form action={submitForReviewAction}>
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
            <p className="text-sm text-border">
              {dict.reviewBlocked(blockingNames)}
            </p>
          ))}
        {initial.status === RiskAssessmentStatus.IN_REVIEW && (
          <form action={approveAction}>
            <button
              type="submit"
              className="self-start rounded bg-accent px-4 py-2 text-sm font-semibold text-background"
            >
              {dict.approve}
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {ALL_ENVIRONMENTAL_CATEGORIES.map((category) => {
          const status =
            statusByCategory.get(category) ?? CategoryCheckStatus.OPEN;
          const categoryFindings = findingsByCategory.get(category) ?? [];
          const categoryAspects = aspectsByCategory.get(category) ?? [];
          return (
            <details
              key={category}
              className="rounded-lg border border-border bg-surface"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3">
                <span className="font-semibold">
                  {dict.aspectCategoryLabels[category]}
                </span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    status === CategoryCheckStatus.OPEN
                      ? "border-coral text-coral"
                      : status === CategoryCheckStatus.HAZARD_PRESENT
                        ? "border-accent text-accent"
                        : "border-border text-border"
                  }`}
                >
                  {dict.categoryStatusLabels[status]}
                </span>
              </summary>

              <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
                {categoryFindings.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">
                      {dict.findingsHeading}
                    </h3>
                    {categoryFindings.map((finding) => (
                      <div
                        key={finding.id}
                        className="flex flex-col gap-2 rounded border border-border bg-background p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">
                            {finding.aspect.name}
                          </span>
                          <span className="flex items-center gap-2 text-border">
                            {dict.riskLabel} {riskBandLabels[finding.riskBand]}
                            {finding.significant && (
                              <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-background">
                                {dict.significantBadge}
                              </span>
                            )}
                          </span>
                        </div>
                        {finding.notes && (
                          <p className="text-border">{finding.notes}</p>
                        )}

                        <div>
                          <h4 className="text-xs font-semibold">
                            {dict.quantitiesHeading}
                          </h4>
                          {finding.quantities.length === 0 ? (
                            <p className="text-xs text-border">
                              {dict.quantitiesEmpty}
                            </p>
                          ) : (
                            <ul className="text-xs">
                              {finding.quantities.map((q) => (
                                <li key={q.id}>
                                  {q.value} {q.unit}
                                  {q.isEstimate && (
                                    <span className="ml-1 rounded-full border border-border px-1 text-[10px]">
                                      {dict.estimateBadge}
                                    </span>
                                  )}
                                  {" — "}
                                  {q.periodStart.toISOString().slice(0, 10)} /{" "}
                                  {q.periodEnd.toISOString().slice(0, 10)} (
                                  {q.source})
                                </li>
                              ))}
                            </ul>
                          )}

                          <form
                            action={addQuantityAction}
                            className="mt-2 flex flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="environmentalFindingId"
                              value={finding.id}
                            />
                            <label className="flex flex-col gap-1 text-xs">
                              {dict.valueLabel}
                              <input
                                type="number"
                                step="any"
                                name="value"
                                required
                                className="w-24 rounded border border-border bg-surface px-2 py-1"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              {dict.unitLabel}
                              <input
                                name="unit"
                                required
                                className="w-20 rounded border border-border bg-surface px-2 py-1"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              {dict.periodStartLabel}
                              <input
                                type="date"
                                name="periodStart"
                                required
                                className="rounded border border-border bg-surface px-2 py-1"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              {dict.periodEndLabel}
                              <input
                                type="date"
                                name="periodEnd"
                                required
                                className="rounded border border-border bg-surface px-2 py-1"
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs">
                              {dict.sourceLabel}
                              <input
                                name="source"
                                required
                                className="w-40 rounded border border-border bg-surface px-2 py-1"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <input type="checkbox" name="isEstimate" />
                              {dict.isEstimateLabel}
                            </label>
                            <button
                              type="submit"
                              className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                            >
                              {dict.addQuantity}
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {categoryAspects.length > 0 && (
                  <form
                    action={addFindingAction}
                    className="flex flex-col gap-3 rounded border border-border bg-background p-3"
                  >
                    <h3 className="text-sm font-semibold">
                      {dict.addFindingHeading}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex flex-col gap-1 text-sm">
                        {dict.aspectLabel}
                        <select
                          name="aspectId"
                          className="rounded border border-border bg-surface px-2 py-1"
                        >
                          {categoryAspects.map((aspect) => (
                            <option key={aspect.id} value={aspect.id}>
                              {aspect.name}
                            </option>
                          ))}
                        </select>
                      </label>
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
                      <label className="flex flex-col gap-1 text-sm">
                        {dict.operatingConditionLabel}
                        <select
                          name="operatingCondition"
                          className="rounded border border-border bg-surface px-2 py-1"
                        >
                          {OPERATING_CONDITIONS.map((condition) => (
                            <option key={condition} value={condition}>
                              {dict.operatingConditionLabels[condition]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="legallyRelevant" />
                      {dict.legallyRelevantLabel}
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.existingControlsLabel}
                      <input
                        name="existingControls"
                        className="rounded border border-border bg-surface px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.findingNotesLabel}
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
                        <option value={CategoryCheckStatus.CHECKED_NO_HAZARD}>
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
    </div>
  );
}
