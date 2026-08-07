import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { getActiveMethodologyVersion } from "@/lib/scoring/methodology-version";

// Read-only, platform-global (no tenant/site scoping — ScoringRule rows
// aren't per-company data) — lets a client-side consumer (e.g. a what-if
// simulator re-running matchScoringRule against slider-adjusted angles)
// fetch the active rule set once and then match locally with zero further
// server round-trips.
//
// Field names mirror ScoringRule's own columns (angleMin/angleMax,
// inclusive/exclusive per matchScoringRule's convention) rather than the
// AngleRangeRule generic's field names being renamed in transit, so a
// fetched row can be passed to matchScoringRule directly with no mapping
// step. No cameraAngle field: ScoringRule carries no such column — the
// camera-angle gate (e.g. ELBOW/TRUNK/NECK/KNEE requiring SAGITTAL) is a
// separate, static per-region table in src/lib/pose/angles.ts, unrelated to
// ScoringRule rows or the active methodology version.
export async function GET() {
  const user = await getCurrentPlatformUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  const rows = await prisma.scoringRule.findMany({
    where: { methodologyVersion },
    select: {
      bodyRegion: true,
      angleMin: true,
      angleMax: true,
      riskBand: true,
      riskScore: true,
    },
  });

  return Response.json({
    methodologyVersion,
    rules: rows,
  });
}
