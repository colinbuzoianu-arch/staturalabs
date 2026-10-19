import type {
  BodyZone,
  ExposureShare,
  RiskBand,
  ZoneLoadLevel,
} from "@/generated/prisma/enums";
import { BodyZone as BodyZoneEnum } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Zone-posture rule lookup (H2, SLD_IMPLEMENTATION_PLAN_hazards-and-
// environment.md §4.2). Deliberately NO `import "server-only"` — the pure
// matcher below is unit-tested directly, exactly the matchScoringRule /
// lookupScoringRule split the rest of this engine uses.

export const ALL_BODY_ZONES: BodyZone[] = Object.values(BodyZoneEnum);

export type PostureZoneRuleRow = {
  zone: BodyZone;
  level: ZoneLoadLevel;
  share: ExposureShare;
  riskBand: RiskBand;
  riskScore: number;
  methodologyVersion: string;
};

// Pure matcher — mirrors matchScoringRule exactly: returns the single rule
// for (zone, level, share), null if none, and throws on an ambiguous set
// (more than one row for the same key). The DB's unique index on
// (methodologyVersion, zone, level, share) already guarantees at most one,
// so the throw is a fail-closed guard, never an expected path — same
// defensive posture as matchScoringRule's ambiguity throw.
export function matchPostureZoneRule(
  rules: PostureZoneRuleRow[],
  zone: BodyZone,
  level: ZoneLoadLevel,
  share: ExposureShare,
): PostureZoneRuleRow | null {
  const matches = rules.filter(
    (rule) =>
      rule.zone === zone && rule.level === level && rule.share === share,
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous PostureZoneRule set: ${matches.length} rows match ${zone}/${level}/${share}`,
    );
  }
  return matches[0];
}

export async function lookupPostureZoneRules(
  methodologyVersion: string,
): Promise<PostureZoneRuleRow[]> {
  return prisma.postureZoneRule.findMany({
    where: { methodologyVersion },
    select: {
      zone: true,
      level: true,
      share: true,
      riskBand: true,
      riskScore: true,
      methodologyVersion: true,
    },
  });
}
