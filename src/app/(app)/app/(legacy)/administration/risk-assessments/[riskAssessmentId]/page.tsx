import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { forwardQuery } from "@/lib/routes/forward-query";

// Redirect stub: the risk-assessment detail page moved into the risk module
// under the shell (P2). The old URL is resource-first (no site segment), so
// resolve the assessment's site, then forward (preserving query — present
// mode threads ?present=1&workstationId=…&from=…).
export default async function LegacyRiskAssessmentDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ riskAssessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { riskAssessmentId } = await params;
  const ra = await prisma.riskAssessment.findUnique({
    where: { id: riskAssessmentId },
    select: { siteId: true },
  });
  if (!ra) notFound();
  redirect(
    `/app/s/${ra.siteId}/risk/assessments/${riskAssessmentId}${forwardQuery(await searchParams)}`,
  );
}
