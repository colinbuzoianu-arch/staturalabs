import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { forwardQuery } from "@/lib/routes/forward-query";

// Redirect stub: the workstation hub moved into the risk module under the
// sidebar shell (P2). Resolves the site from the workstation id (the old URL
// didn't carry it) and forwards any query (present mode etc.).
export default async function LegacyWorkstationHubRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ workstationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workstationId } = await params;
  const ws = await prisma.workstation.findUnique({
    where: { id: workstationId },
    select: { siteId: true },
  });
  if (!ws) notFound();
  redirect(
    `/app/s/${ws.siteId}/risk/workstations/${workstationId}${forwardQuery(await searchParams)}`,
  );
}
