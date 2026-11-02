import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { forwardQuery } from "@/lib/routes/forward-query";

export default async function LegacyWorkstationOverviewRedirect({
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
    `/app/s/${ws.siteId}/risk/workstations/${workstationId}/overview${forwardQuery(await searchParams)}`,
  );
}
