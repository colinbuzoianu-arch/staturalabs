import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RiskAssessmentStatus } from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { lookupRiskMatrixCell } from "@/lib/risk/matrix-lookup";

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
}: {
  params: Promise<{ riskAssessmentId: string }>;
}) {
  const { riskAssessmentId } = await params;
  const initial = await loadRiskAssessment(riskAssessmentId);
  const { site } = await requireSiteAdministrationAccess(initial.siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).riskAssessmentDetailPage;
  const statusLabels =
    getAdministrationDictionary(locale).riskAssessmentStatusLabels;
  const categoryLabels =
    getAdministrationDictionary(locale).hazardCategoryLabels;

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
        limitValue,
        limitReference,
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

  const subjectName = initial.workstation?.name ?? initial.process?.name ?? "";

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

      <div className="flex gap-2">
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
            <label className="flex flex-col gap-1 text-sm">
              {dict.hazardLabel}
              <select
                name="hazardId"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {hazards.map((hazard) => (
                  <option key={hazard.id} value={hazard.id}>
                    [{categoryLabels[hazard.category]}] {hazard.name}
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
                      {finding.measurements.map((measurement) => (
                        <li key={measurement.id}>
                          {measurement.value} {measurement.unit}
                          {measurement.limitValue !== null &&
                            ` (${dict.limitValueLabel.replace(" (optional)", "")}: ${measurement.limitValue} ${measurement.unit}${measurement.limitReference ? `, ${measurement.limitReference}` : ""})`}
                          {" — "}
                          {measurement.measuredAt.toISOString()}
                        </li>
                      ))}
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
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.unitLabel}
                      <input
                        name="unit"
                        required
                        className="w-24 rounded border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.limitValueLabel}
                      <input
                        type="number"
                        step="any"
                        name="limitValue"
                        className="w-24 rounded border border-border bg-background px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      {dict.limitReferenceLabel}
                      <input
                        name="limitReference"
                        className="w-32 rounded border border-border bg-background px-2 py-1"
                      />
                    </label>
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
