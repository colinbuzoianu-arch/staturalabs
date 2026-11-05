import { describe, expect, it } from "vitest";
import {
  type ApplicabilityCriteria,
  parseApplicability,
  type SiteFacts,
  suggestApplicability,
} from "./applicability";

const facts = (over: Partial<SiteFacts> = {}): SiteFacts => ({
  oshActive: true,
  environmentActive: true,
  hazardCategories: [],
  usesSubstances: false,
  hasWasteStreams: false,
  employeeCount: null,
  ...over,
});

describe("suggestApplicability (P11)", () => {
  it("APPLICABLE when the domain is active and no other criteria", () => {
    const r = suggestApplicability({ domain: "OSH" }, facts());
    expect(r.status).toBe("APPLICABLE");
    expect(r.rationale).toBeNull();
  });

  it("NOT_APPLICABLE with rationale when the domain module is off", () => {
    const r = suggestApplicability(
      { domain: "ENVIRONMENT" },
      facts({ environmentActive: false }),
    );
    expect(r.status).toBe("NOT_APPLICABLE");
    expect(r.rationale).toContain("environment module not active");
  });

  it("hazard-category criterion: applicable only if one is present", () => {
    const crit: ApplicabilityCriteria = {
      domain: "OSH",
      requiresHazardCategories: ["NOISE", "VIBRATION"],
    };
    expect(
      suggestApplicability(crit, facts({ hazardCategories: ["NOISE"] })).status,
    ).toBe("APPLICABLE");
    expect(
      suggestApplicability(crit, facts({ hazardCategories: ["CHEMICAL"] }))
        .status,
    ).toBe("NOT_APPLICABLE");
  });

  it("substances / waste-stream criteria", () => {
    expect(
      suggestApplicability(
        { domain: "OSH", requiresSubstances: true },
        facts({ usesSubstances: true }),
      ).status,
    ).toBe("APPLICABLE");
    expect(
      suggestApplicability(
        { domain: "ENVIRONMENT", requiresWasteStreams: true },
        facts(),
      ).status,
    ).toBe("NOT_APPLICABLE");
  });

  it("minEmployees: below threshold → NOT_APPLICABLE; unknown count → not excluded on that basis", () => {
    const crit: ApplicabilityCriteria = {
      domain: "ENVIRONMENT",
      minEmployees: 21,
    };
    expect(
      suggestApplicability(crit, facts({ employeeCount: 10 })).status,
    ).toBe("NOT_APPLICABLE");
    expect(
      suggestApplicability(crit, facts({ employeeCount: 50 })).status,
    ).toBe("APPLICABLE");
    // Unknown count must not auto-exclude — left to the human.
    expect(
      suggestApplicability(crit, facts({ employeeCount: null })).status,
    ).toBe("APPLICABLE");
  });

  it("combines multiple unmet criteria into one rationale", () => {
    const r = suggestApplicability(
      {
        domain: "OSH",
        requiresSubstances: true,
        requiresHazardCategories: ["CHEMICAL"],
      },
      facts({ usesSubstances: false, hazardCategories: [] }),
    );
    expect(r.status).toBe("NOT_APPLICABLE");
    expect(r.rationale).toContain("no CHEMICAL hazard");
    expect(r.rationale).toContain("no hazardous substances");
  });

  it("parseApplicability defaults domain to OSH and tolerates missing fields", () => {
    expect(parseApplicability({}).domain).toBe("OSH");
    expect(parseApplicability({ domain: "ENVIRONMENT" }).domain).toBe(
      "ENVIRONMENT",
    );
    expect(parseApplicability(null).requiresSubstances).toBeUndefined();
  });
});
