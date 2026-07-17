import { ManualInputType } from "@/generated/prisma/enums";
import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { canAccessSite } from "@/lib/auth/rbac";
import { validateManualInputShape } from "@/lib/capture/manual-input";
import { prisma } from "@/lib/prisma";

function isValidManualInputType(value: unknown): value is ManualInputType {
  return (
    typeof value === "string" &&
    (Object.values(ManualInputType) as string[]).includes(value)
  );
}

// Same conventions as POST /api/posture-samples: structural validation,
// then resource lookup, then RBAC, then persist. No scoring/rules consume
// these values yet (load-weighted scoring is a separate, not-yet-designed
// pass) — this route only records the row.
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
  const { taskId, inputType, value, unit, textValue, notes } = body as Record<
    string,
    unknown
  >;

  if (typeof taskId !== "string" || taskId.length === 0) {
    return Response.json(
      { error: "taskId must be a non-empty string" },
      { status: 400 },
    );
  }
  if (!isValidManualInputType(inputType)) {
    return Response.json(
      {
        error: `inputType must be one of ${Object.values(ManualInputType).join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (value !== undefined && value !== null && typeof value !== "number") {
    return Response.json(
      { error: "value must be a number or null" },
      { status: 400 },
    );
  }
  if (unit !== undefined && unit !== null && typeof unit !== "string") {
    return Response.json(
      { error: "unit must be a string or null" },
      { status: 400 },
    );
  }
  if (
    textValue !== undefined &&
    textValue !== null &&
    typeof textValue !== "string"
  ) {
    return Response.json(
      { error: "textValue must be a string or null" },
      { status: 400 },
    );
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return Response.json(
      { error: "notes must be a string or null" },
      { status: 400 },
    );
  }

  const normalized = {
    inputType,
    value: typeof value === "number" ? value : null,
    unit: typeof unit === "string" ? unit : null,
    textValue: typeof textValue === "string" ? textValue : null,
  };

  const shapeError = validateManualInputShape(normalized);
  if (shapeError) {
    return Response.json({ error: shapeError }, { status: 400 });
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

  const manualInput = await prisma.manualInput.create({
    data: {
      taskId,
      inputType: normalized.inputType,
      value: normalized.value,
      unit: normalized.unit,
      textValue: normalized.textValue,
      notes: typeof notes === "string" ? notes : null,
    },
  });

  return Response.json({ manualInput }, { status: 201 });
}
