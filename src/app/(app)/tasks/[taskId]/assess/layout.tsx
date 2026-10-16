import type { ReactNode } from "react";
import { requireTaskAccess } from "@/lib/auth/require-access";

// Wires the capture page (a "use client" component, can't do the server-
// side access check itself) into the same site-scoped RBAC as the rest of
// the dashboard and as POST /api/posture-samples/manual — previously this route
// had no access gate of its own at all, reachable by anyone signed in who
// knew/guessed the taskId. requireTaskAccess 404s rather than redirects on
// a task that exists but isn't accessible, so it doesn't confirm the
// taskId is real to someone who shouldn't see it.
export default async function CaptureLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  await requireTaskAccess(taskId);

  return <>{children}</>;
}
