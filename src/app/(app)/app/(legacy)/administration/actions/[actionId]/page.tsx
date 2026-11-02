import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { forwardQuery } from "@/lib/routes/forward-query";

// Redirect stub: the action detail moved into the Maßnahmen module under the
// shell (P2). The old URL is resource-first; resolve the action's site and
// forward preserving query (present mode threads ?present=1&workstationId=…).
export default async function LegacyActionDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ actionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { actionId } = await params;
  const action = await prisma.action.findUnique({
    where: { id: actionId },
    select: { siteId: true },
  });
  if (!action) notFound();
  redirect(
    `/app/s/${action.siteId}/actions/${actionId}${forwardQuery(await searchParams)}`,
  );
}
