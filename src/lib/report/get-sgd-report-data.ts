import "server-only";

import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";
import { deriveAppliedStandards } from "./applied-standards";

export type SgdScope = { siteId: string; workstationId?: string };

// The DOK-VO-shaped SGD (SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B5) —
// site-wide by default, or scoped to one workstation (DOK-VO permits
// grouping comparable workplaces/activities, so both are legitimate
// scopes; the site-wide one is what gets shown to an inspector). Returns
// null on a missing site, a missing workstation, or a workstationId that
// doesn't belong to siteId — the route handler 404s on any of these, same
// "resource-first, then scope-check" pattern as requireWorkstationAccess.
export async function getSgdReportData(scope: SgdScope) {
  const site = await prisma.site.findUnique({
    where: { id: scope.siteId },
    include: { company: true },
  });
  if (!site) return null;

  let workstation: Awaited<ReturnType<typeof prisma.workstation.findUnique>> =
    null;
  if (scope.workstationId) {
    workstation = await prisma.workstation.findUnique({
      where: { id: scope.workstationId },
    });
    if (!workstation || workstation.siteId !== scope.siteId) return null;
  }

  // Workstation scope deliberately matches only RiskAssessments whose own
  // workstationId is this workstation — it does not pull in Process-level
  // assessments that merely touch this workstation via ProcessTask. That
  // would need an extra join for a grouping DOK-VO doesn't require any
  // particular SGD scope to resolve; the site-wide scope already covers
  // process-level assessments directly.
  const riskAssessmentWhere = workstation
    ? { workstationId: workstation.id }
    : { siteId: scope.siteId };

  const riskAssessments = await prisma.riskAssessment.findMany({
    where: riskAssessmentWhere,
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
    orderBy: { assessedAt: "asc" },
  });

  const actionWhere = workstation
    ? {
        OR: [
          {
            riskFinding: {
              riskAssessment: { workstationId: workstation.id },
            },
          },
          { assessmentSession: { workstationId: workstation.id } },
        ],
      }
    : { siteId: scope.siteId };

  const actions = await prisma.action.findMany({
    where: actionWhere,
    include: { verificationAssessment: true },
    orderBy: { createdAt: "asc" },
  });

  // "Generated from the methodology version's own rule set, not
  // hardcoded" (§7 B5 item 6) — only claim a standard applies when its
  // rule table actually has rows for the version currently active, rather
  // than unconditionally listing every standard SLD has ever drawn on.
  const methodologyVersion = await getActiveMethodologyVersion();
  const [
    scoringRuleCount,
    holdTimeRuleCount,
    manualHandlingRuleCount,
    repetitionRuleCount,
  ] = await Promise.all([
    prisma.scoringRule.count({ where: { methodologyVersion } }),
    prisma.holdTimeRule.count({ where: { methodologyVersion } }),
    prisma.manualHandlingRule.count({ where: { methodologyVersion } }),
    prisma.repetitionRule.count({ where: { methodologyVersion } }),
  ]);
  const appliedStandards = deriveAppliedStandards({
    hasScoringRules: scoringRuleCount > 0,
    hasHoldTimeRules: holdTimeRuleCount > 0,
    hasManualHandlingRules: manualHandlingRuleCount > 0,
    hasRepetitionRules: repetitionRuleCount > 0,
  });

  const userIds = new Set<string>();
  for (const ra of riskAssessments) {
    userIds.add(ra.assessorUserId);
    if (ra.approvedByUserId) userIds.add(ra.approvedByUserId);
  }
  for (const a of actions) {
    if (a.responsibleUserId) userIds.add(a.responsibleUserId);
    if (a.verifiedByUserId) userIds.add(a.verifiedByUserId);
  }
  const users = await prisma.platformUser.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true },
  });
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  // DOK-VO item 3's "per workplace or activity group" is the CURRENT
  // state — the latest APPROVED assessment per distinct workstation/
  // process subject in scope (same "latest APPROVED" precedent as the
  // workstation risk view and site risk overview), falling back to the
  // latest assessment of any status if none is APPROVED yet, so an
  // assessed-but-unapproved subject still appears rather than silently
  // vanishing — an unassessed or not-yet-approved workplace is itself
  // something an inspector should be able to see, not a gap to hide.
  // Item 8's "review/adaptation history" is every assessment in scope,
  // regardless of status, in chronological order — the full
  // `riskAssessments` list already is that.
  const bySubject = new Map<string, typeof riskAssessments>();
  for (const ra of riskAssessments) {
    const key = ra.workstationId ?? ra.processId ?? ra.id;
    const list = bySubject.get(key) ?? [];
    list.push(ra);
    bySubject.set(key, list);
  }
  const currentAssessments = [...bySubject.values()].map((list) =>
    (() => {
      const approved = list.filter((r) => r.status === "APPROVED");
      const pool = approved.length > 0 ? approved : list;
      return pool.reduce((latest, r) =>
        r.assessedAt > latest.assessedAt ? r : latest,
      );
    })(),
  );

  return {
    site,
    workstation,
    generatedAt: new Date(),
    methodologyVersion,
    appliedStandards,
    currentAssessments,
    history: riskAssessments,
    actions,
    userNames,
  };
}

export type SgdReportData = NonNullable<
  Awaited<ReturnType<typeof getSgdReportData>>
>;
