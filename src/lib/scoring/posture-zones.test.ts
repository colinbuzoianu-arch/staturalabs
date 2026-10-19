import { describe, expect, it } from "vitest";
import type {
  BodyZone,
  ExposureShare,
  ZoneLoadLevel,
} from "@/generated/prisma/enums";
import {
  ALL_BODY_ZONES,
  matchPostureZoneRule,
  type PostureZoneRuleRow,
} from "./posture-zones";

// Literal fixture mirroring the 45 seeded v3-2026-10 rows
// (20261016130100_add_posture_zone_rules_v3). Base table for every zone,
// with the TRUNK / SHOULDERS_ARMS exception (HIGH + OCCASIONAL -> HIGH).
const LEVELS: ZoneLoadLevel[] = ["LOW", "MEDIUM", "HIGH"];
const SHARES: ExposureShare[] = ["RARE", "OCCASIONAL", "PREDOMINANT"];
const SCORE_TO_BAND = {
  1: "LOW",
  2: "MODERATE",
  3: "ELEVATED",
  4: "HIGH",
} as const;

function cellScore(
  zone: BodyZone,
  level: ZoneLoadLevel,
  share: ExposureShare,
): number {
  if (level === "LOW") return 1;
  if (level === "MEDIUM") {
    return share === "RARE" ? 1 : share === "OCCASIONAL" ? 2 : 3;
  }
  // HIGH
  const isException = zone === "TRUNK" || zone === "SHOULDERS_ARMS";
  if (share === "RARE") return 2;
  if (share === "OCCASIONAL") return isException ? 4 : 3;
  return 4; // PREDOMINANT
}

const RULES: PostureZoneRuleRow[] = ALL_BODY_ZONES.flatMap((zone) =>
  LEVELS.flatMap((level) =>
    SHARES.map((share) => {
      const riskScore = cellScore(zone, level, share);
      return {
        zone,
        level,
        share,
        riskScore,
        riskBand: SCORE_TO_BAND[riskScore as 1 | 2 | 3 | 4],
        methodologyVersion: "v3-2026-10",
      };
    }),
  ),
);

describe("matchPostureZoneRule (pure)", () => {
  it("resolves every zone x level x share to exactly one rule (all 45)", () => {
    expect(RULES).toHaveLength(45);
    for (const zone of ALL_BODY_ZONES) {
      for (const level of LEVELS) {
        for (const share of SHARES) {
          const match = matchPostureZoneRule(RULES, zone, level, share);
          expect(match, `${zone}/${level}/${share}`).not.toBeNull();
          expect(match?.riskScore).toBe(cellScore(zone, level, share));
        }
      }
    }
  });

  it("applies LOW level as LOW(1) at every share", () => {
    for (const share of SHARES) {
      expect(
        matchPostureZoneRule(RULES, "HEAD_NECK", "LOW", share)?.riskBand,
      ).toBe("LOW");
    }
  });

  it("scores a base zone's HIGH+OCCASIONAL as ELEVATED(3)", () => {
    const m = matchPostureZoneRule(RULES, "HEAD_NECK", "HIGH", "OCCASIONAL");
    expect(m?.riskBand).toBe("ELEVATED");
    expect(m?.riskScore).toBe(3);
  });

  it("applies the TRUNK/SHOULDERS_ARMS exception: HIGH+OCCASIONAL -> HIGH(4)", () => {
    for (const zone of ["TRUNK", "SHOULDERS_ARMS"] as BodyZone[]) {
      const m = matchPostureZoneRule(RULES, zone, "HIGH", "OCCASIONAL");
      expect(m?.riskBand, zone).toBe("HIGH");
      expect(m?.riskScore, zone).toBe(4);
    }
  });

  it("returns null when no rule matches", () => {
    expect(matchPostureZoneRule([], "TRUNK", "LOW", "RARE")).toBeNull();
  });

  it("throws on an ambiguous rule set", () => {
    const dup = [
      ...RULES,
      matchPostureZoneRule(
        RULES,
        "TRUNK",
        "HIGH",
        "RARE",
      ) as PostureZoneRuleRow,
    ];
    expect(() => matchPostureZoneRule(dup, "TRUNK", "HIGH", "RARE")).toThrow(
      /Ambiguous/,
    );
  });
});
