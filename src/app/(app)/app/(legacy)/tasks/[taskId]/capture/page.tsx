import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Capture was already retired to the assess flow; the old URL now lands on the
// assess page in the shell.
export default async function LegacyCaptureRedirect({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { workstation: { select: { siteId: true } } },
  });
  if (!t) notFound();
  redirect(`/app/s/${t.workstation.siteId}/risk/tasks/${taskId}/assess`);
}
