import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { canAccessSite } from "@/lib/auth/rbac";
import { createPostureSample } from "@/lib/capture/create-posture-sample";
import { validateHoldDurationSeconds } from "@/lib/capture/hold-duration";
import { validateManualAngles } from "@/lib/capture/manual-angles";
import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

// Receives { angles, taskId } — angles keyed by the 8 computed BodyRegion
// values, flexion-from-neutral degrees (SLD_IMPLEMENTATION_PLAN_austria-
// first.md §5). A sibling of POST /api/posture-samples (camera capture),
// not a variant of it: the request/response shape stays a plain, separate
// contract so the camera route's shipped, field-validated wire format
// never has to change to make room for this (see CLAUDE.md "Frozen and
// demoted work" — a regression on the camera path is a real regression).
// The response is the same PostureSampleResponse shape either way.
export async function POST(request: Request) {
  const user = await getCurrentPlatformUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json(
      { error: "Expected a JSON object body" },
      { status: 400 },
    );
  }
  const { angles, taskId, holdDurationSeconds } = body as Record<
    string,
    unknown
  >;

  const validatedAngles = validateManualAngles(angles);
  if (typeof validatedAngles === "string") {
    return Response.json({ error: validatedAngles }, { status: 400 });
  }
  if (typeof taskId !== "string" || taskId.length === 0) {
    return Response.json(
      { error: "taskId must be a non-empty string" },
      { status: 400 },
    );
  }
  const validatedHoldDuration =
    validateHoldDurationSeconds(holdDurationSeconds);
  if (typeof validatedHoldDuration === "string") {
    return Response.json({ error: validatedHoldDuration }, { status: 400 });
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, workstation: { select: { siteId: true } } },
  });
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!(await canAccessSite(user, task.workstation.siteId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let methodologyVersion: string;
  try {
    methodologyVersion = await getActiveMethodologyVersion();
  } catch (err) {
    // Fails closed (no active version = misconfiguration), not a 400 —
    // this isn't the caller's fault.
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "No active methodology version",
      },
      { status: 500 },
    );
  }

  try {
    const response = await createPostureSample({
      source: "MANUAL_ENTRY",
      taskId,
      angles: validatedAngles,
      methodologyVersion,
      holdDurationSeconds: validatedHoldDuration,
    });
    return Response.json(response, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not score the entered angles",
      },
      { status: 422 },
    );
  }
}
