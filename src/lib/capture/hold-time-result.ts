import "server-only";

import type { BodyRegion, RiskBand } from "@/generated/prisma/enums";
import {
  lookupHoldTimeRules,
  matchHoldTimeBand,
  worstScoredPostureBand,
} from "@/lib/scoring/hold-time";
import type { HoldTimeResult, RegionResult } from "./types";

// Assembles the hold-time sub-score from an already-computed `regions`
// record (either freshly scored, or read back for an existing sample —
// this doesn't care which) plus the sample's own `holdDurationSeconds`.
// Shared by createPostureSample (both CAMERA_MEDIAPIPE and MANUAL_ENTRY
// writes) and every read view that wants to show it, the same
// "one function, every caller" shape buildRegionResultsForSample already
// uses for the posture side.
export async function computeHoldTimeResult(params: {
  regions: Record<BodyRegion, RegionResult>;
  holdDurationSeconds: number | null;
  methodologyVersion: string;
}): Promise<HoldTimeResult> {
  if (params.holdDurationSeconds === null) return null;

  const scoredBands: RiskBand[] = Object.values(params.regions).flatMap(
    (result) => (result.status === "scored" ? [result.riskBand] : []),
  );
  const worstPostureBand = worstScoredPostureBand(scoredBands);
  if (!worstPostureBand) return null;

  const rules = await lookupHoldTimeRules(params.methodologyVersion);
  const holdTimeBand = matchHoldTimeBand(
    rules,
    worstPostureBand,
    params.holdDurationSeconds,
  );

  return {
    holdDurationSeconds: params.holdDurationSeconds,
    worstPostureBand,
    holdTimeBand,
    // matchHoldTimeBand only ever returns null or "HIGH" — the worst
    // possible band — so "worst-of" collapses to this simple fallback
    // without needing a generic multi-band aggregator.
    overallBand: holdTimeBand ?? worstPostureBand,
  };
}
