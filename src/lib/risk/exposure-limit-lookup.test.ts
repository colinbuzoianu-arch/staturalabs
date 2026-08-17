import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExposureLimitModel } from "@/generated/prisma/models";

vi.mock("@/lib/prisma", () => ({
  prisma: { exposureLimit: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  lookupExposureLimits,
  matchExposureLimits,
} from "./exposure-limit-lookup";

// Mirrors the seeded v1-at-2026 rows from
// prisma/migrations/20260817160100_seed_exposure_limit_v1_at_2026,
// verified against the live DB when the migration was applied.
const LIMITS = [
  { id: "1", country: "AT", hazardCategory: "NOISE", parameterKey: "LA_EX_8H" },
  { id: "2", country: "AT", hazardCategory: "NOISE", parameterKey: "LC_PEAK" },
  {
    id: "3",
    country: "AT",
    hazardCategory: "VIBRATION",
    parameterKey: "AHW_8H",
  },
  {
    id: "4",
    country: "AT",
    hazardCategory: "ERGONOMIC_MSD",
    parameterKey: "MANUAL_HANDLING",
  },
] as const;

describe("matchExposureLimits", () => {
  it("returns every row for the given country/hazardCategory", () => {
    const result = matchExposureLimits(LIMITS, "AT", "NOISE");
    expect(result.map((r) => r.parameterKey)).toEqual(["LA_EX_8H", "LC_PEAK"]);
  });

  it("returns a single row when only one parameter exists for the category", () => {
    const result = matchExposureLimits(LIMITS, "AT", "VIBRATION");
    expect(result).toHaveLength(1);
    expect(result[0].parameterKey).toBe("AHW_8H");
  });

  it("returns [] for a country with no seeded rows — never a fallback to another country", () => {
    expect(matchExposureLimits(LIMITS, "CH", "NOISE")).toEqual([]);
  });

  it("returns [] for a hazard category with no rows in this country", () => {
    expect(matchExposureLimits(LIMITS, "AT", "PSYCHOSOCIAL")).toEqual([]);
  });

  it("returns [] for an empty candidate set", () => {
    expect(matchExposureLimits([], "AT", "NOISE")).toEqual([]);
  });
});

describe("lookupExposureLimits", () => {
  beforeEach(() => {
    vi.mocked(prisma.exposureLimit.findMany).mockReset();
  });

  it("queries by catalogVersion/hazardCategory and delegates to matchExposureLimits for the country filter", async () => {
    vi.mocked(prisma.exposureLimit.findMany).mockResolvedValue(
      LIMITS as unknown as ExposureLimitModel[],
    );

    const result = await lookupExposureLimits({
      country: "AT",
      hazardCategory: "NOISE",
      catalogVersion: "v1-at-2026",
    });

    expect(prisma.exposureLimit.findMany).toHaveBeenCalledWith({
      where: { catalogVersion: "v1-at-2026", hazardCategory: "NOISE" },
    });
    expect(result.map((r) => r.parameterKey)).toEqual(["LA_EX_8H", "LC_PEAK"]);
  });

  it("returns [] — never a cross-country fallback — when the DB has rows for other countries only", async () => {
    vi.mocked(prisma.exposureLimit.findMany).mockResolvedValue(
      LIMITS as unknown as ExposureLimitModel[],
    );

    const result = await lookupExposureLimits({
      country: "CH",
      hazardCategory: "NOISE",
      catalogVersion: "v1-at-2026",
    });

    expect(result).toEqual([]);
  });

  it("returns [] when no rows come back for the catalogVersion at all", async () => {
    vi.mocked(prisma.exposureLimit.findMany).mockResolvedValue([]);

    const result = await lookupExposureLimits({
      country: "AT",
      hazardCategory: "NOISE",
      catalogVersion: "unknown-version",
    });

    expect(result).toEqual([]);
  });
});
