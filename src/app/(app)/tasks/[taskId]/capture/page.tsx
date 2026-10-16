import { permanentRedirect } from "next/navigation";

// The posture/manual assessment page moved from /capture to /assess as part
// of dropping the camera-era "capture" framing
// (SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §3.3). This permanent
// redirect keeps old links and bookmarks working. No auth gate here on
// purpose: it resolves no data, it only forwards to /assess, which runs the
// real requireTaskAccess gate in its own layout.
export default async function CaptureRedirectPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  permanentRedirect(`/tasks/${taskId}/assess`);
}
