import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { forwardQuery } from "@/lib/routes/forward-query";

// Redirect stub: the task page moved into the risk module under the shell.
export default async function LegacyTaskRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { taskId } = await params;
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { workstation: { select: { siteId: true } } },
  });
  if (!t) notFound();
  redirect(
    `/app/s/${t.workstation.siteId}/risk/tasks/${taskId}${forwardQuery(await searchParams)}`,
  );
}
