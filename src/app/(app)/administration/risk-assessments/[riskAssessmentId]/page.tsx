import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AddFindingFields,
  type FindingHazardOption,
} from "@/components/add-finding-fields";
import {
  ExposureLimitFields,
  type ExposureLimitOption,
} from "@/components/exposure-limit-fields";
import { PresentModeNav } from "@/components/present-mode-nav";
import {
  PsychosocialDimension,
  PsychosocialMethod,
  RiskAssessmentStatus,
} from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { isPresentMode } from "@/lib/present-mode";
import { prisma } from "@/lib/prisma";
import { getActiveExposureLimitCatalog } from "@/lib/risk/exposure-limit-catalog-version";
import { matchExposureLimits } from "@/lib/risk/exposure-limit-lookup";
import { exposureThresholdStatus } from "@/lib/risk/exposure-threshold-status";
import { lookupRiskMatrixCell } from "@/lib/risk/matrix-lookup";
import { createPsychosocialFinding } from "@/lib/risk/psychosocial-finding";

const PSYCHOSOCIAL_DIMENSIONS = Object.values(PsychosocialDimension);
const PSYCHOSOCIAL_METHODS = Object.values(PsychosocialMethod);

async function loadRiskAssessment(riskAssessmentId: string) {
  const riskAssessment = await prisma.riskAssessment.findUnique({
    where: { id: riskAssessmentId },
    include: {
      workstation: true,
      process: true,
      findings: {
        include: {
          hazard: true,
          measurements: { orderBy: { measuredAt: "desc" } },
          psychosocialDetail: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!riskAssessment) notFound();
  return riskAssessment;
}

// A dated risk assessment (of exactly one workstation or process, see the
// hand-added CHECK) doesn't live under a site in the URL — it's already
// globally identified by id — so access is resource-first: fetch it, then
// gate on its own siteId. Same fail-closed 404-not-redirect pattern as
// requireTaskAccess (never reveals "exists but you can't see it").
export default async function RiskAssessmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ riskAssessmentId: string }>;
  searchParams: Promise<{
    present?: string;
    actionId?: string;
    workstationId?: string;
    from?: string;
  }>;
}) {
  const { riskAssessmentId } = await params;
  const { present, actionId, workstationId, from } = await searchParams;
  const presentMode = isPresentMode(present);
  const initial = await loadRiskAssessment(riskAssessmentId);
  const { site } = await requireSiteAdministrationAccess(initial.siteId);
  const locale = await getLocale();
  const administrationDict = getAdministrationDictionary(locale);
  const dict = administrationDict.riskAssessmentDetailPage;
  const statusLabels = administrationDict.riskAssessmentStatusLabels;
  const categoryLabels = administrationDict.hazardCategoryLabels;

  async function submitForReviewAction() {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    const { site: currentSite } = await requireSiteAdministrationAccess(
      current.siteId,
    );
    const dict = getAdministrationDictionary(
      await getLocale(),
    ).riskAssessmentDetailPage;

    if (current.status !== RiskAssessmentStatus.DRAFT) {
      throw new Error(dict.illegalTransition);
    }
    await prisma.riskAssessment.update({
      where: { id: riskAssessmentId },
      data: { status: RiskAssessmentStatus.IN_REVIEW },
    });
    revalidatePath(`/administration/risk-assessments/${riskAssessmentId}`);
    revalidatePath(`/administration/sites/${currentSite.id}/risk-assessments`);
  }

  async function approveAction() {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    const { user, site: currentSite } = await requireSiteAdministrationAccess(
      current.siteId,
    );
    const dict = getAdministrationDictionary(
      await getLocale(),
    ).riskAssessmentDetailPage;

    if (current.status !== RiskAssessmentStatus.IN_REVIEW) {
      throw new Error(dict.illegalTransition);
    }
    await prisma.riskAssessment.update({
      where: { id: riskAssessmentId },
      data: {
        status: RiskAssessmentStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
      },
    });
    revalidatePath(`/administration/risk-assessments/${riskAssessmentId}`);
    revalidatePath(`/administration/sites/${currentSite.id}/risk-assessments`);
  }

  async function addFindingAction(formData: FormData) {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    await requireSiteAdministrationAccess(current.siteId);
    const dict = getAdministrationDictionary(
      await getLocale(),
    ).riskAssessmentDetailPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const hazardId = formData.get("hazardId");
    if (typeof hazardId !== "string" || hazardId.length === 0) {
      throw new Error(dict.hazardRequired);
    }

    const probabilityRaw = formData.get("probability");
    const probability =
      typeof probabilityRaw === "string"
        ? Number.parseInt(probabilityRaw, 10)
        : NaN;
    if (!Number.isInteger(probability) || probability < 1 || probability > 5) {
      throw new Error(dict.probabilityRangeError);
    }

    const severityRaw = formData.get("severity");
    const severity =
      typeof severityRaw === "string" ? Number.parseInt(severityRaw, 10) : NaN;
    if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
      throw new Error(dict.severityRangeError);
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

    const cell = await lookupRiskMatrixCell({
      probability,
      severity,
      matrixVersion: current.matrixVersion,
    });
    if (!cell) {
      throw new Error(commonDict.unexpectedError(dict.noMatrixCellError));
    }

    // Re-fetched here rather than trusted from the page's own `hazards`
    // closure — a Server Action runs as its own invocation, not a
    // continuation of whichever render produced the form, so it must not
    // rely on data computed elsewhere in that render for correctness
    // (same discipline as `current`/`site` being re-fetched above rather
    // than trusted from outer scope).
    const hazard = await prisma.hazard.findUnique({
      where: { id: hazardId },
      select: { category: true },
    });
    if (!hazard) {
      throw new Error(dict.hazardRequired);
    }

    if (hazard.category === "PSYCHOSOCIAL") {
      const dimensionRaw = formData.get("dimension");
      if (
        typeof dimensionRaw !== "string" ||
        !PSYCHOSOCIAL_DIMENSIONS.includes(dimensionRaw as never)
      ) {
        throw new Error(dict.psychosocialDimensionRequired);
      }

      const methodRaw = formData.get("method");
      if (
        typeof methodRaw !== "string" ||
        !PSYCHOSOCIAL_METHODS.includes(methodRaw as never)
      ) {
        throw new Error(dict.psychosocialMethodRequired);
      }

      const groupSizeRaw = formData.get("groupSize");
      const groupSize =
        typeof groupSizeRaw === "string"
          ? Number.parseInt(groupSizeRaw, 10)
          : NaN;
      if (!Number.isInteger(groupSize)) {
        throw new Error(dict.psychosocialGroupSizeRequired);
      }

      const externalProcedureNameRaw = formData.get("externalProcedureName");
      const externalProcedureName =
        typeof externalProcedureNameRaw === "string" &&
        externalProcedureNameRaw.trim().length > 0
          ? externalProcedureNameRaw.trim()
          : null;

      try {
        await createPsychosocialFinding({
          riskAssessmentId,
          hazardId,
          probability,
          severity,
          riskScore: cell.riskScore,
          riskBand: cell.riskBand,
          existingControls,
          notes,
          dimension: dimensionRaw as PsychosocialDimension,
          method: methodRaw as PsychosocialMethod,
          groupSize,
          externalProcedureName,
        });
      } catch (error) {
        throw new Error(
          commonDict.unexpectedError(
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    } else {
      await prisma.riskFinding.create({
        data: {
          riskAssessmentId,
          hazardId,
          probability,
          severity,
          riskScore: cell.riskScore,
          riskBand: cell.riskBand,
          existingControls,
          notes,
        },
      });
    }

    revalidatePath(`/administration/risk-assessments/${riskAssessmentId}`);
  }

  async function addMeasurementAction(formData: FormData) {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    await requireSiteAdministrationAccess(current.siteId);
    const dict = getAdministrationDictionary(
      await getLocale(),
    ).riskAssessmentDetailPage;

    const riskFindingId = formData.get("riskFindingId");
    if (typeof riskFindingId !== "string" || riskFindingId.length === 0) {
      throw new Error(dict.hazardRequired);
    }

    const valueRaw = formData.get("value");
    const value =
      typeof valueRaw === "string" ? Number.parseFloat(valueRaw) : NaN;
    if (Number.isNaN(value)) {
      throw new Error(dict.valueRequired);
    }

    const unit = formData.get("unit");
    if (typeof unit !== "string" || unit.trim().length === 0) {
      throw new Error(dict.unitRequired);
    }

    const actionValueRaw = formData.get("actionValue");
    const actionValue =
      typeof actionValueRaw === "string" && actionValueRaw.trim().length > 0
        ? Number.parseFloat(actionValueRaw)
        : null;

    const actionValueReferenceRaw = formData.get("actionValueReference");
    const actionValueReference =
      typeof actionValueReferenceRaw === "string" &&
      actionValueReferenceRaw.trim().length > 0
        ? actionValueReferenceRaw.trim()
        : null;

    const limitValueRaw = formData.get("limitValue");
    const limitValue =
      typeof limitValueRaw === "string" && limitValueRaw.trim().length > 0
        ? Number.parseFloat(limitValueRaw)
        : null;

    const limitReferenceRaw = formData.get("limitReference");
    const limitReference =
      typeof limitReferenceRaw === "string" &&
      limitReferenceRaw.trim().length > 0
        ? limitReferenceRaw.trim()
        : null;

    // Provenance only (see ExposureMeasurement's schema comment) — not
    // re-validated against the catalog here, the same trust-from-context
    // level RiskAssessment.matrixVersion already gets. An invalid id
    // would fail at the DB's own FK constraint, which is enough.
    const exposureLimitIdRaw = formData.get("exposureLimitId");
    const exposureLimitId =
      typeof exposureLimitIdRaw === "string" && exposureLimitIdRaw.length > 0
        ? exposureLimitIdRaw
        : null;

    const instrumentRaw = formData.get("instrument");
    const instrument =
      typeof instrumentRaw === "string" && instrumentRaw.trim().length > 0
        ? instrumentRaw.trim()
        : null;

    const methodRaw = formData.get("method");
    const method =
      typeof methodRaw === "string" && methodRaw.trim().length > 0
        ? methodRaw.trim()
        : null;

    const measuredAtRaw = formData.get("measuredAt");
    if (
      typeof measuredAtRaw !== "string" ||
      measuredAtRaw.trim().length === 0
    ) {
      throw new Error(dict.measuredAtRequired);
    }
    const measuredAt = new Date(measuredAtRaw);
    if (Number.isNaN(measuredAt.getTime())) {
      throw new Error(dict.measuredAtRequired);
    }

    await prisma.exposureMeasurement.create({
      data: {
        riskFindingId,
        value,
        unit: unit.trim(),
        actionValue,
        actionValueReference,
        limitValue,
        limitReference,
        exposureLimitId,
        instrument,
        method,
        measuredAt,
      },
    });

    revalidatePath(`/administration/risk-assessments/${riskAssessmentId}`);
  }

  const [systemHazards, companyHazards] = await Promise.all([
    prisma.hazard.findMany({
      where: { companyId: null },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
    prisma.hazard.findMany({
      where: { companyId: site.companyId },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
  ]);
  const hazards = [...systemHazards, ...companyHazards];

  // Fetched once for the whole page (not per finding) — every finding's
  // "Parameter" picker below filters this same set by its own hazard
  // category via the pure matchExposureLimits, rather than each issuing
  // its own lookupExposureLimits query. Scoped to site.country at the
  // query level, so a site outside AT (e.g. CH, no seeded rows yet) gets
  // an empty set here and every finding's form falls back to manual entry
  // — never another country's numbers (ERGO_COMPLIANCE_BY_DESIGN.md
  // §3.15). A missing/inactive catalog degrades the same way: the rest of
  // the page (and the pre-existing free-text fields) keeps working.
  let exposureLimits: Awaited<
    ReturnType<typeof prisma.exposureLimit.findMany>
  > = [];
  try {
    const catalogVersion = await getActiveExposureLimitCatalog();
    exposureLimits = await prisma.exposureLimit.findMany({
      where: { catalogVersion, country: site.country },
    });
  } catch {
    exposureLimits = [];
  }

  const subjectName = initial.workstation?.name ?? initial.process?.name ?? "";

  // §7 B6 present-mode sequence's 3rd stop. prevHref/workstationId both
  // arrive threaded from the workstation risk page's own next link (no
  // new query here); nextHref only exists when that same threading
  // supplied an actionId (a workstation with no qualifying open action
  // simply ends the sequence at this page).
  const effectiveWorkstationId = workstationId ?? initial.workstationId;
  const currentHref = `/administration/risk-assessments/${riskAssessmentId}?present=1${effectiveWorkstationId ? `&workstationId=${effectiveWorkstationId}` : ""}`;
  const presentPrevHref =
    from ??
    (effectiveWorkstationId
      ? `/workstations/${effectiveWorkstationId}/risk?present=1`
      : null);
  const presentNextHref =
    actionId && effectiveWorkstationId
      ? `/administration/actions/${actionId}?present=1&workstationId=${effectiveWorkstationId}&from=${encodeURIComponent(currentHref)}`
      : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <p className="text-sm text-border">
        <Link
          href={`/administration/sites/${site.id}/risk-assessments`}
          className="hover:text-accent"
        >
          {dict.breadcrumbRiskAssessments}
        </Link>{" "}
        / {subjectName}
      </p>

      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{subjectName}</h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-border">
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.statusLabel}</dt>
            <dd>{statusLabels[initial.status]}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.assessedAtLabel}</dt>
            <dd>{initial.assessedAt.toISOString()}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-semibold">{dict.matrixVersionLabel}</dt>
            <dd>{initial.matrixVersion}</dd>
          </div>
          {initial.pilotContext && (
            <div className="flex gap-1">
              <dt className="font-semibold">{dict.pilotContextLabel}</dt>
              <dd>{initial.pilotContext}</dd>
            </div>
          )}
        </dl>
      </div>

      {presentMode && (
        <PresentModeNav
          prevHref={presentPrevHref}
          nextHref={presentNextHref}
          prevLabel={administrationDict.presentMode.workstationRiskLabel}
          nextLabel={administrationDict.presentMode.actionLabel}
        />
      )}

      <div className="flex gap-2">
        {/* Plain <a>, not next/link: a real file download
            (Content-Disposition: attachment), not a client-side page
            transition — same reasoning as the task report's link. */}
        <a
          href={`/api/risk-assessments/${initial.id}/report`}
          className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          {dict.downloadReport}
        </a>
        {initial.status === RiskAssessmentStatus.DRAFT && (
          <form action={submitForReviewAction}>
            <button
              type="submit"
              className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
            >
              {dict.submitForReview}
            </button>
          </form>
        )}
        {initial.status === RiskAssessmentStatus.IN_REVIEW && (
          <form action={approveAction}>
            <button
              type="submit"
              className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
            >
              {dict.approve}
            </button>
          </form>
        )}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">
          {dict.findingsHeading}
        </h2>

        <form
          action={addFindingAction}
          className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <h3 className="text-sm font-semibold">{dict.addFindingHeading}</h3>
          <div className="flex flex-wrap gap-2">
            <AddFindingFields
              hazards={hazards.map(
                (hazard): FindingHazardOption => ({
                  id: hazard.id,
                  category: hazard.category,
                  label: `[${categoryLabels[hazard.category]}] ${hazard.name}`,
                }),
              )}
              labels={{
                hazardLabel: dict.hazardLabel,
                dimensionLabel: dict.psychosocialDimensionLabel,
                dimensionOptions: dict.psychosocialDimensionLabels,
                methodLabel: dict.psychosocialMethodLabel,
                methodOptions: dict.psychosocialMethodLabels,
                groupSizeLabel: dict.psychosocialGroupSizeLabel,
                groupSizeQuestionnaireHint:
                  dict.psychosocialGroupSizeQuestionnaireHint,
                externalProcedureNameLabel:
                  dict.psychosocialExternalProcedureNameLabel,
              }}
            />
            <label className="flex flex-col gap-1 text-sm">
              {dict.probabilityLabel}
              <input
                type="number"
                name="probability"
                min={1}
                max={5}
                required
                className="w-20 rounded border border-border bg-background px-2 py-1"
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
                className="w-20 rounded border border-border bg-background px-2 py-1"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            {dict.existingControlsLabel}
            <input
              name="existingControls"
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
            {dict.addFinding}
          </button>
        </form>

        {initial.findings.length === 0 ? (
          <p className="text-sm text-border">{dict.findingsEmpty}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {initial.findings.map((finding) => (
              <div
                key={finding.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    [{categoryLabels[finding.hazard.category]}]{" "}
                    {finding.hazard.name}
                  </span>
                  <span className="text-sm text-border">
                    {dict.riskScoreLabel} {finding.riskScore} ·{" "}
                    {dict.riskBandLabel} {finding.riskBand}
                  </span>
                </div>
                {finding.existingControls && (
                  <p className="text-sm text-border">
                    {finding.existingControls}
                  </p>
                )}
                {finding.notes && (
                  <p className="text-sm text-border">{finding.notes}</p>
                )}
                {finding.psychosocialDetail && (
                  <p className="text-sm text-border">
                    {
                      dict.psychosocialDimensionLabels[
                        finding.psychosocialDetail.dimension
                      ]
                    }{" "}
                    ·{" "}
                    {
                      dict.psychosocialMethodLabels[
                        finding.psychosocialDetail.method
                      ]
                    }{" "}
                    · {dict.psychosocialGroupSizeDisplayLabel}{" "}
                    {finding.psychosocialDetail.groupSize}
                    {finding.psychosocialDetail.externalProcedureName &&
                      ` · ${dict.psychosocialExternalProcedureNameDisplayLabel} ${finding.psychosocialDetail.externalProcedureName}`}
                  </p>
                )}

                <div>
                  <h4 className="text-sm font-semibold">
                    {dict.measurementsHeading}
                  </h4>
                  {finding.measurements.length === 0 ? (
                    <p className="text-sm text-border">
                      {dict.measurementsEmpty}
                    </p>
                  ) : (
                    <ul className="text-sm">
                      {finding.measurements.map((measurement) => {
                        const status = exposureThresholdStatus(measurement);
                        return (
                          <li key={measurement.id}>
                            {measurement.value} {measurement.unit}
                            {measurement.actionValue !== null &&
                              ` (${dict.actionValueDisplayLabel} ${measurement.actionValue} ${measurement.unit}${measurement.actionValueReference ? `, ${measurement.actionValueReference}` : ""})`}
                            {measurement.limitValue !== null &&
                              ` (${dict.limitValueDisplayLabel} ${measurement.limitValue} ${measurement.unit}${measurement.limitReference ? `, ${measurement.limitReference}` : ""})`}
                            {status !== "within-limits" && (
                              <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-background">
                                {status === "over-limit-value"
                                  ? dict.overLimitValueBadge
                                  : dict.overActionValueBadge}
                              </span>
                            )}
                            {" — "}
                            {measurement.measuredAt.toISOString()}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <form
                    action={addMeasurementAction}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input
                      type="hidden"
                      name="riskFindingId"
                      value={finding.id}
                    />
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.valueLabel}
                      <input
                        type="number"
                        step="any"
                        name="value"
                        required
                        className="w-24 rounded border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <ExposureLimitFields
                      options={matchExposureLimits(
                        exposureLimits,
                        site.country,
                        finding.hazard.category,
                      ).map(
                        (limit): ExposureLimitOption => ({
                          id: limit.id,
                          parameterKey: limit.parameterKey,
                          parameterLabel: limit.parameterLabel,
                          unit: limit.unit,
                          actionValue: limit.actionValue,
                          limitValue: limit.limitValue,
                          legalReference: limit.legalReference,
                        }),
                      )}
                      labels={{
                        parameterLabel: dict.parameterLabel,
                        parameterManualOption: dict.parameterManualOption,
                        noExposureLimitForCountry:
                          dict.noExposureLimitForCountry(site.country),
                        unitLabel: dict.unitLabel,
                        actionValueLabel: dict.actionValueLabel,
                        actionValueReferenceLabel:
                          dict.actionValueReferenceLabel,
                        limitValueLabel: dict.limitValueLabel,
                        limitReferenceLabel: dict.limitReferenceLabel,
                      }}
                    />
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.instrumentLabel}
                      <input
                        name="instrument"
                        className="w-32 rounded border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.methodLabel}
                      <input
                        name="method"
                        className="w-32 rounded border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.measuredAtLabel}
                      <input
                        type="datetime-local"
                        name="measuredAt"
                        required
                        className="rounded border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                    >
                      {dict.addMeasurement}
                    </button>
                  </form>
                </div>

                <Link
                  href={`/administration/sites/${site.id}/actions?fromFindingId=${finding.id}`}
                  className="self-start text-sm underline hover:text-accent"
                >
                  {dict.raiseAction}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
