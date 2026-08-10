"use server";

import { revalidatePath } from "next/cache";
import type { BodyRegion } from "@/generated/prisma/enums";
import { requireTaskAccess } from "@/lib/auth/require-access";
import { buildRegionResults } from "@/lib/capture/build-region-results";
import type { RegionResult } from "@/lib/capture/types";
import type { PoseLandmark } from "@/lib/pose/angles";
import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

// Same structural guard POST /api/posture-samples uses before trusting a
// landmarks array (isPoseLandmark/isValidLandmarks there are private to
// that route) — a Server Action is reachable directly via POST, bypassing
// the page, so this needs its own independent check rather than trusting
// whatever the client happened to send.
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

export type ValidatePostureSampleResult = {
  regionResults: Record<BodyRegion, RegionResult>;
  validatedAt: Date;
};

// Persists a human-reviewed posture as a PostureSample's final, validated
// measurement (ERGO_COMPLIANCE_BY_DESIGN.md §3.4 — mandatory human
// review). Re-scores `validatedKeypoints` through the exact same pipeline
// the original capture used (buildRegionResults -> computeBodyAngles +
// lookupScoringRule per region, against the currently-active
// MethodologyVersion) so the persisted BodyRegionScore rows always reflect
// whatever posture was actually validated — never a stale, preliminary
// score left sitting next to a validated keypoints array. The original
// `keypoints` column is never read for writing and never touched here: it
// stays the immutable MediaPipe output, exactly as captured.
//
// Derives its own task/site context from the sample (via requireTaskAccess
// on sample.taskId) rather than from a caller-supplied taskId, so it's
// reusable as-is from any surface with a PostureSample id in hand —
// currently both (app)/tasks/[taskId] and /admin/tasks/[taskId] import
// this same function. That's deliberate, not an accident of file
// placement: requireTaskAccess's own canAccessSite check already grants
// super_admin/l3_support access correctly (see rbac.ts), and this is a
// multi-step transactional re-scoring operation, not a one-line guard —
// duplicating it across two files would be a real drift risk this
// codebase's usual "small helper, fine to duplicate" precedent (e.g.
// isPoseLandmark above) doesn't extend to.
export async function validatePostureSample(
  postureSampleId: string,
  validatedKeypoints: unknown,
): Promise<ValidatePostureSampleResult> {
  const sample = await prisma.postureSample.findUnique({
    where: { id: postureSampleId },
    select: {
      id: true,
      taskId: true,
      cameraAngle: true,
      validationStatus: true,
    },
  });
  if (!sample) {
    throw new Error("Posture sample not found");
  }

  const { user } = await requireTaskAccess(sample.taskId);

  // Once validated, a sample's result is final. Re-validating would need a
  // separate "unlock" flow (clearing validationStatus back to
  // PENDING_REVIEW under its own audited action) that doesn't exist yet —
  // deliberately out of scope here: silently letting a second validation
  // overwrite the first would undermine the "final measurement" guarantee
  // the whole validation step exists to provide.
  if (sample.validationStatus === "VALIDATED") {
    throw new Error(
      "This posture sample has already been validated and cannot be re-validated.",
    );
  }

  if (!isValidLandmarks(validatedKeypoints)) {
    throw new Error(
      "validatedKeypoints must be an array of 33 { x, y, z, visibility? } points",
    );
  }

  const methodologyVersion = await getActiveMethodologyVersion();

  // Prospective scoring: buildRegionResults prefers validatedKeypoints
  // only when validationStatus is VALIDATED, but the DB row is still
  // PENDING_REVIEW at this exact point — we're computing what the result
  // WOULD be for the state this transaction is about to commit, not
  // reading the row's current state. Passing "VALIDATED" here describes
  // that prospective state, not a (false) claim about what's persisted
  // yet; `keypoints` is set to the same array since it's never actually
  // read once validatedKeypoints is present, just required by the
  // function's signature.
  const { regions: regionResults } = await buildRegionResults({
    keypoints: validatedKeypoints,
    validatedKeypoints,
    validationStatus: "VALIDATED",
    cameraAngle: sample.cameraAngle,
    methodologyVersion,
  });

  const scoredRows = Object.entries(regionResults).flatMap(
    ([region, result]) =>
      result.status === "scored"
        ? [
            {
              bodyRegion: region as BodyRegion,
              score: result.riskScore,
              scoringRuleVersion: result.methodologyVersion,
            },
          ]
        : [],
  );

  const validatedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.postureSample.update({
      where: { id: postureSampleId },
      data: {
        validatedKeypoints,
        validationStatus: "VALIDATED",
        validatedAt,
        validatedByUserId: user.id,
      },
    });

    // The existing rows were preliminary (scored from the raw capture at
    // POST /api/posture-samples time) — replaced wholesale rather than
    // upserted, since a region that no longer scores at all after the
    // review (e.g. now insufficient-visibility because an edit moved a
    // landmark) must not leave a stale row behind.
    await tx.bodyRegionScore.deleteMany({
      where: { postureSampleId },
    });

    if (scoredRows.length > 0) {
      await tx.bodyRegionScore.createMany({
        data: scoredRows.map((row) => ({
          postureSampleId,
          bodyRegion: row.bodyRegion,
          score: row.score,
          scoringRuleVersion: row.scoringRuleVersion,
        })),
      });
    }
  });

  revalidatePath(`/tasks/${sample.taskId}`);
  revalidatePath(`/admin/tasks/${sample.taskId}`);

  return { regionResults, validatedAt };
}
