import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  type MeasureOption,
  RaiseActionForm,
} from "@/components/raise-action-form";
import {
  type HazardCategory,
  HierarchyOfControl,
} from "@/generated/prisma/enums";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import {
  resolveEnvironmentalAspectName,
  resolveHazardName,
} from "@/lib/i18n/catalog-labels";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";
import { isHigherTier, orderTypicalMeasures } from "@/lib/risk/typical-measure";
import { getActiveTypicalMeasureCatalog } from "@/lib/risk/typical-measure-catalog-version";
import { ActionsTabs } from "./calendar/page";

const HIERARCHY_OPTIONS = Object.values(HierarchyOfControl);

export default async function ActionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{
    fromFindingId?: string;
    fromEnvironmentalFindingId?: string;
  }>;
}) {
  const { siteId } = await params;
  const { fromFindingId, fromEnvironmentalFindingId } = await searchParams;
  const { site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).actionsPage;
  const commonDict = getAdministrationDictionary(locale).common;
  const statusLabels = getAdministrationDictionary(locale).actionStatusLabels;
  const hierarchyLabels =
    getAdministrationDictionary(locale).hierarchyOfControlLabels;
  const riskBandLabels = getCommonDictionary(locale).riskBandLabels;

  async function createActionAction(formData: FormData) {
    "use server";
    await requireSiteAdministrationAccess(siteId);
    const dict = getAdministrationDictionary(await getLocale()).actionsPage;
    const commonDict = getAdministrationDictionary(await getLocale()).common;

    const sourceType = formData.get("sourceType");
    const riskFindingIdRaw = formData.get("riskFindingId");
    const assessmentSessionIdRaw = formData.get("assessmentSessionId");
    const environmentalFindingIdRaw = formData.get("environmentalFindingId");

    const isFinding =
      sourceType === "finding" &&
      typeof riskFindingIdRaw === "string" &&
      riskFindingIdRaw.length > 0;
    const isSession =
      sourceType === "session" &&
      typeof assessmentSessionIdRaw === "string" &&
      assessmentSessionIdRaw.length > 0;
    const isEnvFinding =
      sourceType === "environmental-finding" &&
      typeof environmentalFindingIdRaw === "string" &&
      environmentalFindingIdRaw.length > 0;

    if (!isFinding && !isSession && !isEnvFinding) {
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

    // P6 §6: provenance when started from a suggestion. Only for a finding
    // source, and only when the posted id is a real measure of the active
    // catalogue whose category matches the finding's hazard — never trust the
    // posted id. Invalid/mismatched → dropped silently (it's metadata, not a
    // hard input), the action is still created.
    const typicalMeasureIdRaw = formData.get("typicalMeasureId");
    let typicalMeasureId: string | null = null;
    if (
      isFinding &&
      typeof typicalMeasureIdRaw === "string" &&
      typicalMeasureIdRaw.length > 0
    ) {
      const [finding, measure, activeCatalog] = await Promise.all([
        prisma.riskFinding.findUnique({
          where: { id: riskFindingIdRaw as string },
          select: { hazard: { select: { category: true } } },
        }),
        prisma.typicalMeasure.findUnique({
          where: { id: typicalMeasureIdRaw },
          select: { hazardCategory: true, catalogVersion: true },
        }),
        getActiveTypicalMeasureCatalog().catch(() => null),
      ]);
      if (
        finding &&
        measure &&
        measure.catalogVersion === activeCatalog &&
        measure.hazardCategory === finding.hazard.category
      ) {
        typicalMeasureId = typicalMeasureIdRaw;
      }
    }

    try {
      await prisma.action.create({
        data: {
          siteId,
          riskFindingId: isFinding ? (riskFindingIdRaw as string) : null,
          assessmentSessionId: isSession
            ? (assessmentSessionIdRaw as string)
            : null,
          environmentalFindingId: isEnvFinding
            ? (environmentalFindingIdRaw as string)
            : null,
          title: title.trim(),
          description,
          hierarchyOfControl,
          responsibleUserId,
          responsibleRoleLabel,
          dueDate,
          typicalMeasureId,
        },
      });
    } catch (error) {
      throw new Error(
        commonDict.unexpectedError(
          error instanceof Error ? error.message : String(error),
        ),
      );
    }

    revalidatePath(`/app/s/${siteId}/actions`);
  }

  const [actions, findings, sessions, environmentalFindings, platformUsers] =
    await Promise.all([
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
      // P4: environmental findings are a third, equal Action source
      // (Action.environmentalFindingId, the exactly-one-of-three CHECK) —
      // closes the deferred "raise an action from an environmental finding"
      // item. Kept in the OSH/environment domain separation: this only
      // populates the source dropdown, the action itself carries no
      // environmental vocabulary beyond the link.
      prisma.environmentalFinding.findMany({
        where: { environmentalAssessment: { siteId } },
        include: {
          aspect: true,
          environmentalAssessment: { include: { workstation: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.platformUser.findMany({ where: { companyId: site.companyId } }),
    ]);

  // P6 §6: active typical-measure catalogue, grouped by category and ordered
  // by prevention tier. Empty when no catalogue is active (honest empty
  // picker, never invented suggestions).
  let measuresByCategory: Partial<Record<HazardCategory, MeasureOption[]>> = {};
  try {
    const catalogVersion = await getActiveTypicalMeasureCatalog();
    const measures = await prisma.typicalMeasure.findMany({
      where: { catalogVersion },
    });
    const grouped: Partial<Record<HazardCategory, MeasureOption[]>> = {};
    for (const m of measures) {
      const list = grouped[m.hazardCategory] ?? [];
      list.push({
        id: m.id,
        hierarchyOfControl: m.hierarchyOfControl,
        measureDe: m.measureDe,
        measureEn: m.measureEn,
        order: m.order,
      });
      grouped[m.hazardCategory] = list;
    }
    for (const key of Object.keys(grouped) as HazardCategory[]) {
      const list = grouped[key];
      if (list) grouped[key] = orderTypicalMeasures(list);
    }
    measuresByCategory = grouped;
  } catch {
    measuresByCategory = {};
  }

  // Which findings already have an open/implemented action at a higher
  // (technical/substitution/elimination) tier — drives the STOP hint.
  const findingsWithHigherTierAction = new Set(
    actions
      .filter(
        (a) =>
          a.riskFindingId !== null &&
          (a.status === "OPEN" ||
            a.status === "IN_PROGRESS" ||
            a.status === "IMPLEMENTED") &&
          a.hierarchyOfControl !== null &&
          isHigherTier(a.hierarchyOfControl),
      )
      .map((a) => a.riskFindingId as string),
  );

  const findingOptions = findings.map((finding) => ({
    id: finding.id,
    label: `${
      finding.riskAssessment.workstation?.name ??
      finding.riskAssessment.process?.name
    } — ${resolveHazardName(finding.hazard.code, finding.hazard.name, locale)} (${riskBandLabels[finding.riskBand]})`,
    category: finding.hazard.category,
    hasHigherTierAction: findingsWithHigherTierAction.has(finding.id),
  }));

  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
      </div>

      <ActionsTabs
        siteId={siteId}
        active="list"
        dict={getAdministrationDictionary(locale).actionsViews}
      />

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-bold">{dict.createHeading}</h2>
        <RaiseActionForm
          action={createActionAction}
          locale={locale}
          findings={findingOptions}
          sessions={sessions.map((s) => ({
            id: s.id,
            label: `${s.workstation.name} — ${s.startedAt.toISOString()}`,
          }))}
          environmentalFindings={environmentalFindings.map((f) => ({
            id: f.id,
            label: `${f.environmentalAssessment.workstation?.name ?? site.name} — ${resolveEnvironmentalAspectName(f.aspect.code, f.aspect.name, locale)} (${riskBandLabels[f.riskBand]})`,
          }))}
          users={platformUsers.map((u) => ({
            id: u.id,
            label: `${u.name} (${u.email})`,
          }))}
          hierarchyOptions={HIERARCHY_OPTIONS.map((o) => ({
            value: o,
            label: hierarchyLabels[o],
          }))}
          measuresByCategory={measuresByCategory}
          hierarchyLabels={hierarchyLabels}
          defaultFindingId={fromFindingId ?? null}
          defaultEnvironmentalFindingId={fromEnvironmentalFindingId ?? null}
          labels={{
            fromFindingOption: dict.fromFindingOption,
            fromSessionOption: dict.fromSessionOption,
            fromEnvironmentalFindingOption: dict.fromEnvironmentalFindingOption,
            findingLabel: dict.findingLabel,
            sessionLabel: dict.sessionLabel,
            environmentalFindingLabel: dict.environmentalFindingLabel,
            titleLabel: dict.titleLabel,
            descriptionLabel: dict.descriptionLabel,
            hierarchyLabel: dict.hierarchyLabel,
            responsibleUserLabel: dict.responsibleUserLabel,
            responsibleRoleLabel: dict.responsibleRoleLabel,
            dueDateLabel: dict.dueDateLabel,
            create: dict.create,
            none: commonDict.none,
            measuresHeading: dict.typicalMeasuresHeading,
            measuresHint: dict.typicalMeasuresHint,
            measuresNone: dict.typicalMeasuresNone,
            clearSuggestion: dict.typicalMeasuresClear,
            stopHint: dict.typicalMeasuresStopHint,
          }}
        />
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
                      href={`/app/s/${siteId}/actions/${action.id}`}
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
