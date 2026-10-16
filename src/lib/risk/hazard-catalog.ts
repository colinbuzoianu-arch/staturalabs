// Shared hazard-catalogue helpers (no "server-only" — directly
// unit-testable, same reasoning as the other pure cores in src/lib/risk).

// Every HazardCategory has one "-99 / Sonstige Gefährdung (beschreiben)"
// fallback row (seeded in 20261016120200_seed_system_hazard_catalog_expansion,
// SLD_IMPLEMENTATION_PLAN_hazards-and-environment.md §3.2). Picking it means
// "a hazard the catalogue doesn't name", so a free-text description is
// mandatory — otherwise the finding records nothing an inspector could read.
export const OTHER_HAZARD_CODE_SUFFIX = "-99";

export function isOtherHazardCode(code: string): boolean {
  return code.endsWith(OTHER_HAZARD_CODE_SUFFIX);
}
