import type { RiskBand } from "@/generated/prisma/enums";

// Environmental significance (ISO 14001 §6.1.2), SLD_IMPLEMENTATION_PLAN_
// hazards-and-environment.md §5.2. Pure and unit-tested; the result is
// stored on EnvironmentalFinding.significant at write time (never re-derived
// at read time), so a finding's significance stays reproducible even if the
// rule changes later.
//
// An aspect is significant when its assessed band is ELEVATED or HIGH, OR
// when it is legally relevant (a binding obligation applies, §6.1.3) — a
// legally-relevant aspect is significant regardless of band, because the
// obligation itself makes it something the system must manage and show.
export function computeEnvironmentalSignificance(input: {
  riskBand: RiskBand;
  legallyRelevant: boolean;
}): boolean {
  if (input.legallyRelevant) return true;
  return input.riskBand === "ELEVATED" || input.riskBand === "HIGH";
}
