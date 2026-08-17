import type { CountryCode, HazardCategory } from "@/generated/prisma/enums";
import type { ExposureLimitModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Deliberately no `import "server-only"` here — needs to be directly
// unit-testable, same reasoning as scoring/lookup.ts and
// risk/matrix-lookup.ts, which this file mirrors exactly
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.5).

type LimitCandidate = {
  country: CountryCode;
  hazardCategory: HazardCategory;
};

// Pure core — exported so it can be unit tested directly against fixture
// rows, with no DB involved. Unlike matchScoringRule/matchRiskMatrixCell,
// there's no ambiguity to detect here (the DB's own
// ExposureLimit_catalogVersion_country_parameterKey_key constraint
// already guarantees at most one row per parameter per country per
// catalog version) — this is a plain filter, kept as its own pure
// function anyway to match this codebase's established match/lookup
// split and stay independently testable.
//
// Returns every matching row, not one-or-null: a single (country,
// hazardCategory) pair can legitimately have several parameters (NOISE
// has both LA,EX,8h and LC,peak) — the caller decides which parameter it
// wants, this only narrows by country/category.
export function matchExposureLimits<T extends LimitCandidate>(
  limits: readonly T[],
  country: CountryCode,
  hazardCategory: HazardCategory,
): T[] {
  return limits.filter(
    (limit) =>
      limit.country === country && limit.hazardCategory === hazardCategory,
  );
}

// Given (country, hazardCategory, catalogVersion), returns every matching
// ExposureLimit row, or [] on no match — NEVER a fallback to another
// country's values (ERGO_COMPLIANCE_BY_DESIGN.md §3.15/§4). A missing
// Austrian limit is a real, honest gap to show in the UI ("no limit
// configured for this parameter in AT"); silently substituting a German
// or generic number is exactly the failure mode this function exists to
// prevent.
//
// Takes catalogVersion as an explicit param rather than resolving the
// active version itself, mirroring lookupRiskMatrixCell/lookupScoringRule
// exactly — active-version resolution is
// getActiveExposureLimitCatalog's job (./exposure-limit-catalog-version),
// kept separate so a caller can also look up limits under a specific past
// catalog version (re-displaying an already-recorded measurement) without
// that meaning "this is now active."
export async function lookupExposureLimits(params: {
  country: CountryCode;
  hazardCategory: HazardCategory;
  catalogVersion: string;
}): Promise<ExposureLimitModel[]> {
  const candidates = await prisma.exposureLimit.findMany({
    where: {
      catalogVersion: params.catalogVersion,
      hazardCategory: params.hazardCategory,
    },
  });

  return matchExposureLimits(candidates, params.country, params.hazardCategory);
}
