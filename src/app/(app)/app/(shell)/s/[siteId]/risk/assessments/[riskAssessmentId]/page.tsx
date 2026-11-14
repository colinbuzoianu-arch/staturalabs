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
  type ActivityType,
  PsychosocialDimension,
  PsychosocialMethod,
  RiskAssessmentStatus,
} from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/auth/permissions";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getActiveLegalReferenceCatalog } from "@/lib/country/legal-reference-catalog-version";
import { resolveHazardName } from "@/lib/i18n/catalog-labels";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { getLocale } from "@/lib/i18n/get-locale";
import { isPresentMode } from "@/lib/present-mode";
import { prisma } from "@/lib/prisma";
import {
  assertCanSubmitForReview,
  CategoryCompletenessError,
} from "@/lib/risk/category-check";
import { getActiveExposureLimitCatalog } from "@/lib/risk/exposure-limit-catalog-version";
import { matchExposureLimits } from "@/lib/risk/exposure-limit-lookup";
import { exposureThresholdStatus } from "@/lib/risk/exposure-threshold-status";
import {
  assertTaskInAssessmentSubject,
  createFinding,
} from "@/lib/risk/finding";
import { isOtherHazardCode } from "@/lib/risk/hazard-catalog";
import { lookupRiskMatrixCell } from "@/lib/risk/matrix-lookup";
import { computeNextReviewDate, isReviewDue } from "@/lib/risk/review-cycle";

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
          task: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      legalReferenceLinks: {
        include: { legalReference: true },
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
  params: Promise<{ siteId: string; riskAssessmentId: string }>;
  searchParams: Promise<{
    present?: string;
    actionId?: string;
    workstationId?: string;
    from?: string;
  }>;
}) {
  const { siteId, riskAssessmentId } = await params;
  const { present, actionId, workstationId, from } = await searchParams;
  const presentMode = isPresentMode(present);
  const initial = await loadRiskAssessment(riskAssessmentId);
  const { site, user } = await requireSiteAdministrationAccess(initial.siteId);
  // P17 §2: approving (releasing) an assessment is the A column — site admin
  // by default. EHS staff may edit and submit for review (risk.write) but see
  // no approve control unless their company bundle grants risk.approve (§3).
  const canApprove = hasPermission(user, "risk.approve");
  const locale = await getLocale();
  const administrationDict = getAdministrationDictionary(locale);
  const dict = administrationDict.riskAssessmentDetailPage;
  const statusLabels = administrationDict.riskAssessmentStatusLabels;
  const categoryLabels = administrationDict.hazardCategoryLabels;
  const riskBandLabels = getCommonDictionary(locale).riskBandLabels;
  const headerDict = dict.header;
  const reviewDueNow = isReviewDue(
    initial.nextReviewDate,
    initial.reviewRequired,
    new Date(),
  );

  // P6 §6 step link: the tasks a finding may be linked to — this assessment's
  // workstation's tasks, or the tasks in its process. Empty for neither.
  const candidateTasks: Array<{ id: string; name: string }> =
    initial.workstationId
      ? await prisma.task.findMany({
          where: { workstationId: initial.workstationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : initial.processId
        ? (
            await prisma.processTask.findMany({
              where: { processId: initial.processId },
              select: { task: { select: { id: true, name: true } } },
              orderBy: { sequence: "asc" },
            })
          ).map((pt) => pt.task)
        : [];

  // P6 §6 applicable legal references: options = the active catalogue's rows
  // for this site's country (an honest empty list if no catalogue is active —
  // never another country's law, §3.15).
  let legalReferenceOptions: Array<{
    id: string;
    code: string;
    obligation: string;
  }> = [];
  try {
    const catalogVersion = await getActiveLegalReferenceCatalog();
    legalReferenceOptions = await prisma.legalReference.findMany({
      where: { catalogVersion, country: site.country },
      select: { id: true, code: true, obligation: true },
      orderBy: { code: "asc" },
    });
  } catch {
    legalReferenceOptions = [];
  }
  const linkedReferenceIds = new Set(
    initial.legalReferenceLinks.map((l) => l.legalReferenceId),
  );

  async function submitForReviewAction() {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    await requireSiteAdministrationAccess(current.siteId);
    const administrationDict = getAdministrationDictionary(await getLocale());
    const dict = administrationDict.riskAssessmentDetailPage;

    if (current.status !== RiskAssessmentStatus.DRAFT) {
      throw new Error(dict.illegalTransition);
    }

    // Completeness gate (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md
    // §3.1): every hazard category must be assessed before review. The
    // error carries the blocking categories so the message can name them in
    // the viewer's language.
    try {
      await assertCanSubmitForReview(riskAssessmentId);
    } catch (error) {
      if (error instanceof CategoryCompletenessError) {
        const categoryLabels = administrationDict.hazardCategoryLabels;
        const blocking = [
          ...error.openCategories,
          ...error.inconsistentCategories,
        ].map((category) => categoryLabels[category]);
        throw new Error(dict.reviewBlocked(blocking.join(", ")));
      }
      throw error;
    }

    await prisma.riskAssessment.update({
      where: { id: riskAssessmentId },
      data: { status: RiskAssessmentStatus.IN_REVIEW },
    });
    revalidatePath(`/app/s/${siteId}/risk/assessments/${riskAssessmentId}`);
    revalidatePath(`/app/s/${siteId}/risk/assessments`);
  }

  async function approveAction() {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    const { user } = await requireSiteAdministrationAccess(current.siteId);
    const dict = getAdministrationDictionary(
      await getLocale(),
    ).riskAssessmentDetailPage;

    // P17 §2: the A column, re-checked server-side (the button is hidden, but
    // the action is reachable by POST). EHS staff without risk.approve cannot
    // release even if they can submit.
    if (!hasPermission(user, "risk.approve")) notFound();

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
    revalidatePath(`/app/s/${siteId}/risk/assessments/${riskAssessmentId}`);
    revalidatePath(`/app/s/${siteId}/risk/assessments`);
  }

  // P6 §6: save the header attributes + review cycle. Editable in any status
  // (header context and the review schedule aren't gated behind approval).
  // nextReviewDate is taken from the date field if given, else computed from
  // the interval over assessedAt — the one review-date rule lives in
  // computeNextReviewDate.
  async function saveHeaderAction(formData: FormData) {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    await requireSiteAdministrationAccess(current.siteId);

    const str = (k: string) => {
      const v = formData.get(k);
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
    };
    const intOrNull = (k: string) => {
      const v = str(k);
      if (v === null) return null;
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const activityRaw = str("activityType");
    const activityType =
      activityRaw === "ROUTINE" || activityRaw === "NON_ROUTINE"
        ? (activityRaw as ActivityType)
        : null;
    const reviewIntervalMonths = intOrNull("reviewIntervalMonths");
    const explicitReviewDate = str("nextReviewDate");
    const nextReviewDate = explicitReviewDate
      ? new Date(explicitReviewDate)
      : computeNextReviewDate(current.assessedAt, reviewIntervalMonths);
    const reviewRequired = formData.get("reviewRequired") === "on";

    await prisma.riskAssessment.update({
      where: { id: riskAssessmentId },
      data: {
        activityType,
        personsExposedCount: intOrNull("personsExposedCount"),
        shiftPattern: str("shiftPattern"),
        productReference: str("productReference"),
        processDescription: str("processDescription"),
        reviewIntervalMonths,
        nextReviewDate,
        reviewRequired,
        reviewRequiredReason: reviewRequired
          ? str("reviewRequiredReason")
          : null,
      },
    });
    revalidatePath(`/app/s/${siteId}/risk/assessments/${riskAssessmentId}`);
  }

  // P6 §6: save the applicable legal references (a curated subset of the
  // active country catalogue). Replaces the whole set. Each selected id is
  // re-validated against the active catalogue for the site's country — never
  // trusting the posted ids — so a reference from another country/version
  // can't be attached (§3.15).
  async function saveLegalReferencesAction(formData: FormData) {
    "use server";
    const current = await loadRiskAssessment(riskAssessmentId);
    const { site } = await requireSiteAdministrationAccess(current.siteId);

    const posted = new Set(
      formData
        .getAll("legalReferenceIds")
        .filter((v): v is string => typeof v === "string"),
    );

    let allowedIds = new Set<string>();
    try {
      const catalogVersion = await getActiveLegalReferenceCatalog();
      const allowed = await prisma.legalReference.findMany({
        where: { catalogVersion, country: site.country },
        select: { id: true },
      });
      allowedIds = new Set(allowed.map((r) => r.id));
    } catch {
      // No active catalogue — nothing legitimately selectable; clears the set.
      allowedIds = new Set();
    }
    const selected = [...posted].filter((id) => allowedIds.has(id));

    await prisma.$transaction([
      prisma.riskAssessmentLegalReference.deleteMany({
        where: { riskAssessmentId },
      }),
      prisma.riskAssessmentLegalReference.createMany({
        data: selected.map((legalReferenceId) => ({
          riskAssessmentId,
          legalReferenceId,
        })),
      }),
    ]);
    revalidatePath(`/app/s/${siteId}/risk/assessments/${riskAssessmentId}`);
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

    // P6 §6 step link (optional). Validate it belongs to this assessment's
    // own subject (not merely same-site) before it can be stored.
    const taskIdRaw = formData.get("taskId");
    const taskId =
      typeof taskIdRaw === "string" && taskIdRaw.length > 0 ? taskIdRaw : null;
    if (taskId) {
      try {
        await assertTaskInAssessmentSubject(taskId, current);
      } catch {
        throw new Error(dict.taskNotInSubjectError);
      }
    }

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
      select: { category: true, code: true },
    });
    if (!hazard) {
      throw new Error(dict.hazardRequired);
    }

    // A "-99 / Sonstige" catalogue row means the hazard isn't named by the
    // catalogue, so a free-text description is mandatory (§3.2). Checked
    // before the category branch so it applies to psychosocial -99 too.
    if (isOtherHazardCode(hazard.code) && !notes) {
      throw new Error(dict.notesRequiredForOther);
    }

    let dimension: PsychosocialDimension | null = null;
    let method: PsychosocialMethod | null = null;
    let groupSize: number | null = null;
    let externalProcedureName: string | null = null;

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
      const parsedGroupSize =
        typeof groupSizeRaw === "string"
          ? Number.parseInt(groupSizeRaw, 10)
          : NaN;
      if (!Number.isInteger(parsedGroupSize)) {
        throw new Error(dict.psychosocialGroupSizeRequired);
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

    // Single shared write path — same createFinding the workstation hub
    // calls, so the two surfaces can't drift (§3.3). It creates the finding
    // (plus psychosocial detail) and flips the category to HAZARD_PRESENT.
    try {
      await createFinding({
        riskAssessmentId,
        hazardId,
        category: hazard.category,
        probability,
        severity,
        riskScore: cell.riskScore,
        riskBand: cell.riskBand,
        existingControls,
        notes,
        taskId,
        dimension,
        method,
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

    revalidatePath(`/app/s/${siteId}/risk/assessments/${riskAssessmentId}`);
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

    revalidatePath(`/app/s/${siteId}/risk/assessments/${riskAssessmentId}`);
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
  const currentHref = `/app/s/${siteId}/risk/assessments/${riskAssessmentId}?present=1${effectiveWorkstationId ? `&workstationId=${effectiveWorkstationId}` : ""}`;
  const presentPrevHref =
    from ??
    (effectiveWorkstationId
      ? `/app/s/${siteId}/risk/workstations/${effectiveWorkstationId}/overview?present=1`
      : null);
  const presentNextHref =
    actionId && effectiveWorkstationId
      ? `/app/s/${siteId}/actions/${actionId}?present=1&workstationId=${effectiveWorkstationId}&from=${encodeURIComponent(currentHref)}`
      : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
      <p className="text-sm text-border">
        <Link
          href={`/app/s/${siteId}/risk/assessments`}
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

      {reviewDueNow && (
        <div className="rounded-lg border border-status-high bg-surface p-3 text-sm font-semibold text-status-high">
          {headerDict.reviewRequiredBadge}
          {initial.reviewRequiredReason
            ? ` — ${initial.reviewRequiredReason}`
            : ""}
        </div>
      )}

      {!presentMode && (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-bold">
            {headerDict.heading}
          </h2>
          <form
            action={saveHeaderAction}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-sm"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                {headerDict.activityTypeLabel}
                <select
                  name="activityType"
                  defaultValue={initial.activityType ?? ""}
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="">—</option>
                  <option value="ROUTINE">{headerDict.activityRoutine}</option>
                  <option value="NON_ROUTINE">
                    {headerDict.activityNonRoutine}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {headerDict.personsExposedLabel}
                <input
                  type="number"
                  min={0}
                  name="personsExposedCount"
                  defaultValue={initial.personsExposedCount ?? ""}
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                {headerDict.shiftPatternLabel}
                <input
                  name="shiftPattern"
                  defaultValue={initial.shiftPattern ?? ""}
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                {headerDict.productReferenceLabel}
                <input
                  name="productReference"
                  defaultValue={initial.productReference ?? ""}
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              {headerDict.processDescriptionLabel}
              <textarea
                name="processDescription"
                rows={2}
                defaultValue={initial.processDescription ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                {headerDict.reviewIntervalLabel}
                <input
                  type="number"
                  min={0}
                  name="reviewIntervalMonths"
                  defaultValue={initial.reviewIntervalMonths ?? ""}
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1">
                {headerDict.nextReviewDateLabel}
                <input
                  type="date"
                  name="nextReviewDate"
                  defaultValue={
                    initial.nextReviewDate
                      ? initial.nextReviewDate.toISOString().slice(0, 10)
                      : ""
                  }
                  className="rounded border border-border bg-background px-2 py-1"
                />
              </label>
            </div>
            <p className="text-xs text-foreground-subtle">
              {headerDict.nextReviewHint}
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="reviewRequired"
                defaultChecked={initial.reviewRequired}
              />
              {headerDict.reviewRequiredLabel}
            </label>
            <label className="flex flex-col gap-1">
              {headerDict.reviewRequiredReasonLabel}
              <input
                name="reviewRequiredReason"
                defaultValue={initial.reviewRequiredReason ?? ""}
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
            >
              {headerDict.saveButton}
            </button>
          </form>
        </section>
      )}

      {(initial.legalReferenceLinks.length > 0 ||
        (!presentMode && legalReferenceOptions.length > 0)) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold">
            {headerDict.legalReferencesHeading}
          </h2>
          {initial.legalReferenceLinks.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {initial.legalReferenceLinks.map((link) => (
                <li key={link.id}>
                  <span className="font-semibold">
                    {link.legalReference.code}
                  </span>{" "}
                  — {link.legalReference.obligation}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-border">
              {headerDict.legalReferencesEmpty}
            </p>
          )}
          {!presentMode && legalReferenceOptions.length > 0 && (
            <form
              action={saveLegalReferencesAction}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm"
            >
              {legalReferenceOptions.map((ref) => (
                <label key={ref.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="legalReferenceIds"
                    value={ref.id}
                    defaultChecked={linkedReferenceIds.has(ref.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold">{ref.code}</span> —{" "}
                    {ref.obligation}
                  </span>
                </label>
              ))}
              <button
                type="submit"
                className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
              >
                {headerDict.legalReferencesSaveButton}
              </button>
            </form>
          )}
        </section>
      )}

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
        {initial.status === RiskAssessmentStatus.IN_REVIEW && canApprove && (
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
                  label: `[${categoryLabels[hazard.category]}] ${resolveHazardName(hazard.code, hazard.name, locale)}`,
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
          {candidateTasks.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              {dict.stepTaskLabel}
              <select
                name="taskId"
                defaultValue=""
                className="rounded border border-border bg-background px-2 py-1"
              >
                <option value="">{dict.stepTaskNone}</option>
                {candidateTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name}
                  </option>
                ))}
              </select>
            </label>
          )}
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
                    {resolveHazardName(
                      finding.hazard.code,
                      finding.hazard.name,
                      locale,
                    )}
                  </span>
                  <span className="text-sm text-border">
                    {dict.riskScoreLabel} {finding.riskScore} ·{" "}
                    {dict.riskBandLabel} {riskBandLabels[finding.riskBand]}
                  </span>
                </div>
                {finding.task && (
                  <p className="text-xs text-foreground-subtle">
                    {dict.stepTaskPrefix} {finding.task.name}
                  </p>
                )}
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
                  href={`/app/s/${siteId}/actions?fromFindingId=${finding.id}`}
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
