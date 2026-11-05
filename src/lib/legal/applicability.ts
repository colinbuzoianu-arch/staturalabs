import type { HazardCategory } from "@/generated/prisma/enums";

// P11 §1.1 (SLD_P11_LEGAL_REQUIREMENTS_APPROVED.md) applicability core — pure,
// unit-tested. A requirement carries structured criteria; a site carries facts
// (all derived from site/module data, never a person). suggestApplicability
// compares them and returns a SUGGESTION (APPLICABLE / NOT_APPLICABLE + a
// pre-filled rationale) that a human confirms — never an inferred final status
// (same discipline as hazard-category completeness).

export type ApplicabilityCriteria = {
  // Which module domain must be active for this requirement to apply.
  domain: "OSH" | "ENVIRONMENT";
  // Any-of: at least one of these hazard categories present at the site.
  requiresHazardCategories?: HazardCategory[];
  requiresSubstances?: boolean;
  requiresWasteStreams?: boolean;
  // The site's headcount must be at least this (e.g. AWK >20 → minEmployees 21).
  minEmployees?: number;
};

export type SiteFacts = {
  oshActive: boolean;
  environmentActive: boolean;
  hazardCategories: readonly HazardCategory[];
  usesSubstances: boolean;
  hasWasteStreams: boolean;
  employeeCount: number | null;
};

export type ApplicabilitySuggestion = {
  status: "APPLICABLE" | "NOT_APPLICABLE";
  rationale: string | null; // set only for NOT_APPLICABLE (the CHECK needs it)
};

// Narrow an unknown JSON blob to ApplicabilityCriteria defensively — a stored
// row might predate a field. `domain` is required; everything else optional.
export function parseApplicability(value: unknown): ApplicabilityCriteria {
  const v = (value ?? {}) as Record<string, unknown>;
  const domain = v.domain === "ENVIRONMENT" ? "ENVIRONMENT" : "OSH";
  return {
    domain,
    requiresHazardCategories: Array.isArray(v.requiresHazardCategories)
      ? (v.requiresHazardCategories as HazardCategory[])
      : undefined,
    requiresSubstances:
      typeof v.requiresSubstances === "boolean"
        ? v.requiresSubstances
        : undefined,
    requiresWasteStreams:
      typeof v.requiresWasteStreams === "boolean"
        ? v.requiresWasteStreams
        : undefined,
    minEmployees:
      typeof v.minEmployees === "number" ? v.minEmployees : undefined,
  };
}

export function suggestApplicability(
  criteria: ApplicabilityCriteria,
  facts: SiteFacts,
): ApplicabilitySuggestion {
  const unmet: string[] = [];

  const domainActive =
    criteria.domain === "OSH" ? facts.oshActive : facts.environmentActive;
  if (!domainActive) {
    unmet.push(
      criteria.domain === "OSH"
        ? "OSH module not active"
        : "environment module not active",
    );
  }

  if (
    criteria.requiresHazardCategories &&
    criteria.requiresHazardCategories.length > 0
  ) {
    const anyPresent = criteria.requiresHazardCategories.some((c) =>
      facts.hazardCategories.includes(c),
    );
    if (!anyPresent) {
      unmet.push(
        `no ${criteria.requiresHazardCategories.join("/")} hazard at this site`,
      );
    }
  }

  if (criteria.requiresSubstances && !facts.usesSubstances) {
    unmet.push("no hazardous substances in use");
  }

  if (criteria.requiresWasteStreams && !facts.hasWasteStreams) {
    unmet.push("no waste streams recorded");
  }

  if (criteria.minEmployees !== undefined) {
    // Unknown headcount → do NOT suggest NOT_APPLICABLE on a count basis; leave
    // it to the human (return APPLICABLE-leaning by not adding to unmet).
    if (
      facts.employeeCount !== null &&
      facts.employeeCount < criteria.minEmployees
    ) {
      unmet.push(`fewer than ${criteria.minEmployees} employees`);
    }
  }

  if (unmet.length === 0) {
    return { status: "APPLICABLE", rationale: null };
  }
  return {
    status: "NOT_APPLICABLE",
    rationale: `Suggested not applicable: ${unmet.join("; ")}.`,
  };
}
