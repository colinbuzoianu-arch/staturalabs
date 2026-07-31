import "server-only";

import { prisma } from "@/lib/prisma";

// "Produced per deployment" (ERGO_COMPLIANCE_BY_DESIGN.md §3.5) — Site is
// the natural deployment boundary in this data model (a physical location
// a camera is actually used at), so this is generated per-site rather than
// per-company or as one static document.
export async function getWorkerBriefingData(siteId: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { company: true },
  });
  if (!site) return null;

  return { site, generatedAt: new Date() };
}

export type WorkerBriefingData = NonNullable<
  Awaited<ReturnType<typeof getWorkerBriefingData>>
>;
