import "server-only";

import { prisma } from "@/lib/prisma";

// Fetched directly rather than reusing requireSiteAdministrationAccess's
// return shape — a report is a read action available to anyone who can
// read the site (same as the workstation/site risk views), not gated to
// the write surface. The route handler does its own resource-first access
// check (fetch, then requireSiteAccess) after this — same pattern as the
// risk-assessment/action detail pages under (app)/administration.
export async function getRiskAssessmentReportData(riskAssessmentId: string) {
  const riskAssessment = await prisma.riskAssessment.findUnique({
    where: { id: riskAssessmentId },
    include: {
      site: { include: { company: true } },
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
  if (!riskAssessment) return null;

  return { riskAssessment, generatedAt: new Date() };
}

export type RiskAssessmentReportData = NonNullable<
  Awaited<ReturnType<typeof getRiskAssessmentReportData>>
>;
