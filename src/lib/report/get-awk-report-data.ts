import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveAwkCountryPack } from "./awk-availability";

// Data for the Austrian Abfallwirtschaftskonzept (AWK) generator (E4,
// SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §6) — the environmental
// counterpart of getSgdReportData, per site. The route gates on
// resolveAwkCountryPack first (AT only); this builder resolves the pack
// again only to carry the RIS-verified §10 AWG 2002 reference into the
// document (no fabricated legal values — §3.17). Returns null on a missing
// site (the route 404s).
export async function getAwkReportData(scope: { siteId: string }) {
  const site = await prisma.site.findUnique({
    where: { id: scope.siteId },
    include: { company: true },
  });
  if (!site) return null;

  const [
    workstations,
    orgUnits,
    processes,
    assessments,
    wasteStreams,
    actions,
  ] = await Promise.all([
    prisma.workstation.findMany({
      where: { siteId: scope.siteId },
      orderBy: { name: "asc" },
    }),
    prisma.orgUnit.findMany({
      where: { siteId: scope.siteId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.process.findMany({
      where: { siteId: scope.siteId },
      include: {
        tasks: {
          include: { task: { include: { workstation: true } } },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.environmentalAssessment.findMany({
      where: { siteId: scope.siteId },
      include: {
        workstation: true,
        findings: {
          include: {
            aspect: true,
            quantities: { orderBy: { periodEnd: "desc" } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { assessedAt: "asc" },
    }),
    prisma.wasteStream.findMany({
      where: { siteId: scope.siteId },
      include: { originWorkstation: true, originProcess: true },
      orderBy: [{ hazardous: "desc" }, { name: "asc" }],
    }),
    prisma.action.findMany({
      where: {
        environmentalFinding: {
          environmentalAssessment: { siteId: scope.siteId },
        },
      },
      include: {
        environmentalFinding: { include: { aspect: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const userIds = new Set<string>();
  for (const ea of assessments) {
    userIds.add(ea.assessorUserId);
    if (ea.approvedByUserId) userIds.add(ea.approvedByUserId);
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

  // Item 3 (abfallrelevante Beschreibung) also surfaces the significant
  // environmental findings and their quantities, not just the waste streams.
  const significantFindings = assessments.flatMap((ea) =>
    ea.findings.filter((f) => f.significant),
  );

  // Item 5 (voraussichtliche Entwicklung): the free-text estimates recorded
  // on the site's assessments, newest first. Honest empty state if none.
  const futureDevelopmentEntries = assessments
    .filter((ea) => ea.futureDevelopment)
    .map((ea) => ({
      subject: ea.workstation?.name ?? null,
      assessedAt: ea.assessedAt,
      text: ea.futureDevelopment as string,
    }))
    .sort((a, b) => b.assessedAt.getTime() - a.assessedAt.getTime());

  const pack = resolveAwkCountryPack(site.country);

  return {
    site,
    generatedAt: new Date(),
    workstations,
    orgUnits,
    processes,
    assessments,
    wasteStreams,
    actions,
    significantFindings,
    futureDevelopmentEntries,
    userNames,
    legalReference: pack?.environmental?.wasteConceptReference ?? null,
  };
}

export type AwkReportData = NonNullable<
  Awaited<ReturnType<typeof getAwkReportData>>
>;
