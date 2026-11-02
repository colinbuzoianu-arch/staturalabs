import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { forwardQuery } from "@/lib/routes/forward-query";

// Redirect stub: the environmental-assessment detail moved into the
// environment module under the shell (P2). Resolve the assessment's site from
// its id (the old URL is resource-first), then forward preserving query.
export default async function LegacyEnvironmentalAssessmentRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ environmentalAssessmentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { environmentalAssessmentId } = await params;
  const ea = await prisma.environmentalAssessment.findUnique({
    where: { id: environmentalAssessmentId },
    select: { siteId: true },
  });
  if (!ea) notFound();
  redirect(
    `/app/s/${ea.siteId}/environment/assessments/${environmentalAssessmentId}${forwardQuery(await searchParams)}`,
  );
}
