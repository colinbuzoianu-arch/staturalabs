import { CameraAngle } from "@/generated/prisma/enums";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { canAccessSite } from "@/lib/auth/rbac";
import { createPostureSample } from "@/lib/capture/create-posture-sample";
import { validateHoldDurationSeconds } from "@/lib/capture/hold-duration";
import type { PoseLandmark } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

function isPoseLandmark(value: unknown): value is PoseLandmark {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.x === "number" &&
    typeof v.y === "number" &&
    typeof v.z === "number" &&
    (v.visibility === undefined || typeof v.visibility === "number")
  );
}

function isValidLandmarks(value: unknown): value is PoseLandmark[] {
  return (
    Array.isArray(value) && value.length === 33 && value.every(isPoseLandmark)
  );
}

function isValidCameraAngle(value: unknown): value is CameraAngle {
  return (
    typeof value === "string" &&
    (Object.values(CameraAngle) as string[]).includes(value)
  );
}

// Receives { landmarks, cameraAngle, taskId } — the multi-person resolution
// (which detected skeleton is the subject) already happened client-side;
// this route only ever sees a single confirmed set of landmarks.
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
  const { landmarks, cameraAngle, taskId, holdDurationSeconds } =
    body as Record<string, unknown>;

  if (!isValidLandmarks(landmarks)) {
    return Response.json(
      {
        error:
          "landmarks must be an array of 33 { x, y, z, visibility? } points",
      },
      { status: 400 },
    );
  }
  if (!isValidCameraAngle(cameraAngle)) {
    return Response.json(
      {
        error: `cameraAngle must be one of ${Object.values(CameraAngle).join(", ")}`,
      },
      { status: 400 },
    );
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
    // Delegates to createPostureSample (src/lib/capture/create-posture-
    // sample.ts) — the single gate every posture-sample creation path now
    // goes through, camera and manual entry alike. buildRegionResults'
    // NECK indeterminate-facing-direction throw (or any other geometry
    // anomaly) surfaces here as a 422 — a real problem with this specific
    // sample, not a server error.
    const response = await createPostureSample({
      source: "CAMERA_MEDIAPIPE",
      taskId,
      cameraAngle,
      landmarks,
      methodologyVersion,
      holdDurationSeconds: validatedHoldDuration,
    });
    return Response.json(response, { status: 201 });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Could not compute body angles",
      },
      { status: 422 },
    );
  }
}
