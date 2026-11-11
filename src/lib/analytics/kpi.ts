import "server-only";

import { prisma } from "@/lib/prisma";
import {
  percentage,
  ratePerMillionHours,
  ratePerThousand,
  ratio,
} from "./kpi-formulas";
import { withMinimumGroupSize } from "./min-group-size";
import { aggregateWorkforce } from "./workforce-aggregate";

// P12 KPI compute engine (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.10). One
// computation per KPI key; the versioned KpiDefinition supplies the metadata.
// Person-derived KPIs (lost days, instruction coverage) pass through the §3.4
// minimum-group-size gate. Period-sensitive KPIs are scoped by `year`;
// current-state KPIs ignore it. Scope is a set of site ids (one site, or all a
// company's sites) plus the companyId for company-wide data (substances,
// persons). Display-only — a KPI never feeds a scoring or matrix decision.

export type KpiResult = {
  key: string;
  value: number | null;
  suppressed: boolean;
  groupCount?: number;
};

export type KpiScope = {
  siteIds: string[];
  companyId: string;
  year: number;
};

function yearWindow(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

export async function computeKpis(scope: KpiScope): Promise<KpiResult[]> {
  const { siteIds, companyId, year } = scope;
  const { start, end } = yearWindow(year);
  const now = new Date();
  const inSites = { in: siteIds };
  const inYear = { gte: start, lt: end };

  const [
    accidents,
    nearMisses,
    figures,
    healthDetails,
    openActions,
    overdueActions,
    verifiedActions,
    effectiveActions,
    workstationCount,
    approvedAssessmentWorkstations,
    overdueReviews,
    personsActive,
    personsCovered,
    inspectionsTotal,
    inspectionsDone,
    sdsTotal,
    sdsCurrent,
    wasteStreams,
    significantAspects,
  ] = await Promise.all([
    prisma.incident.count({
      where: {
        siteId: inSites,
        type: { in: ["ARBEITSUNFALL", "WEGEUNFALL"] },
        occurredAt: inYear,
      },
    }),
    prisma.incident.count({
      where: { siteId: inSites, type: "BEINAHEUNFALL", occurredAt: inYear },
    }),
    prisma.siteWorkforcePeriod.findMany({
      where: { siteId: inSites, year },
      select: { siteId: true, headcount: true, hoursWorked: true },
    }),
    prisma.incidentHealthDetail.findMany({
      where: {
        involvedPerson: { incident: { siteId: inSites, occurredAt: inYear } },
      },
      select: {
        incapacityDays: true,
        involvedPerson: { select: { personId: true } },
      },
    }),
    prisma.action.count({
      where: { siteId: inSites, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.action.count({
      where: {
        siteId: inSites,
        status: { in: ["OPEN", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    prisma.action.count({ where: { siteId: inSites, status: "VERIFIED" } }),
    prisma.action.count({
      where: {
        siteId: inSites,
        status: "VERIFIED",
        verificationOutcome: "EFFECTIVE",
      },
    }),
    prisma.workstation.count({ where: { siteId: inSites } }),
    prisma.riskAssessment.findMany({
      where: {
        siteId: inSites,
        status: "APPROVED",
        workstationId: { not: null },
      },
      select: { workstationId: true },
      distinct: ["workstationId"],
    }),
    prisma.riskAssessment.count({
      where: {
        siteId: inSites,
        status: "APPROVED",
        nextReviewDate: { lt: now },
      },
    }),
    prisma.person.count({ where: { companyId, active: true } }),
    prisma.person.count({
      where: {
        companyId,
        active: true,
        trainingRecords: { some: { validUntil: { gte: now } } },
      },
    }),
    prisma.inspection.count({ where: { siteId: inSites, createdAt: inYear } }),
    prisma.inspection.count({
      where: {
        siteId: inSites,
        createdAt: inYear,
        status: { in: ["COMPLETED", "CLOSED"] },
      },
    }),
    prisma.safetyDataSheet.count({ where: { substance: { companyId } } }),
    prisma.safetyDataSheet.count({
      where: { substance: { companyId }, supersededAt: null },
    }),
    prisma.wasteStream.findMany({
      where: { siteId: inSites },
      select: { annualQuantity: true },
    }),
    prisma.environmentalFinding.count({
      where: {
        environmentalAssessment: { siteId: inSites },
        significant: true,
      },
    }),
  ]);

  const { headcount, hoursWorked } = aggregateWorkforce(figures);
  const lostDaysTotal = healthDetails.reduce(
    (a, h) => a + (h.incapacityDays ?? 0),
    0,
  );
  const affectedPersons = new Set(
    healthDetails.map((h) => h.involvedPerson.personId),
  ).size;
  const wasteTotal = wasteStreams.reduce(
    (a, w) => a + (w.annualQuantity ?? 0),
    0,
  );

  const plain = (key: string, value: number | null): KpiResult => ({
    key,
    value,
    suppressed: false,
  });
  const grouped = (
    key: string,
    value: number | null,
    groupCount: number,
  ): KpiResult => {
    const g = withMinimumGroupSize(value ?? 0, groupCount);
    return g.suppressed
      ? { key, value: null, suppressed: true, groupCount: g.groupCount }
      : { key, value, suppressed: false, groupCount: g.groupCount };
  };

  return [
    plain("accident-count", accidents),
    plain("accident-rate-1000", ratePerThousand(accidents, headcount)),
    plain(
      "accident-rate-million-hours",
      ratePerMillionHours(accidents, hoursWorked),
    ),
    grouped("lost-days", lostDaysTotal, affectedPersons),
    // G1: severity (Ausfalltage je Unfall) and the lost-day rate per 1.000
    // employees — both lost-day-derived, so min-group-gated on affected persons.
    grouped("severity-rate", ratio(lostDaysTotal, accidents), affectedPersons),
    grouped(
      "lost-day-rate-1000",
      ratePerThousand(lostDaysTotal, headcount),
      affectedPersons,
    ),
    plain("near-miss-ratio", ratio(nearMisses, accidents)),
    // G1: near-miss rate per 1.000 employees (not person-derived).
    plain("near-miss-rate-1000", ratePerThousand(nearMisses, headcount)),
    plain("open-actions", openActions),
    plain("overdue-actions", overdueActions),
    plain(
      "action-effectiveness",
      percentage(effectiveActions, verifiedActions),
    ),
    plain(
      "assessment-completeness",
      percentage(approvedAssessmentWorkstations.length, workstationCount),
    ),
    plain("overdue-reviews", overdueReviews),
    grouped(
      "instruction-coverage",
      percentage(personsCovered, personsActive),
      personsActive,
    ),
    plain(
      "inspection-completion",
      percentage(inspectionsDone, inspectionsTotal),
    ),
    plain("sds-currency", percentage(sdsCurrent, sdsTotal)),
    plain("waste-quantity", wasteStreams.length > 0 ? wasteTotal : null),
    plain("environmental-significance", significantAspects),
  ];
}
