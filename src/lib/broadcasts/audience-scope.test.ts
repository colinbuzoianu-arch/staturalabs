import { describe, expect, it } from "vitest";
import type { PlatformRole } from "@/generated/prisma/enums";
import {
  canRoleSendBroadcasts,
  type SenderScope,
  validateAudienceTarget,
  validateAudienceTargets,
} from "./audience-scope";

const SITE_A = "site-a";
const SITE_B = "site-b";
const UNIT_MONTAGE = "unit-montage";
const UNIT_LAGER = "unit-lager";

const admin: SenderScope = {
  role: "COMPANY_ADMIN",
  companyId: "c1",
  siteIds: new Set([SITE_A, SITE_B]),
  orgUnitIds: null,
};
const siteAdmin: SenderScope = {
  role: "SITE_ADMIN",
  companyId: "c1",
  siteIds: new Set([SITE_A]),
  orgUnitIds: null,
};
const ehs: SenderScope = {
  role: "EHS_SPECIALIST",
  companyId: "c1",
  siteIds: new Set([SITE_A]),
  orgUnitIds: null,
};
const leader: SenderScope = {
  role: "MANAGER",
  companyId: "c1",
  siteIds: new Set([SITE_A]),
  orgUnitIds: new Set([UNIT_MONTAGE]),
};
const employee: SenderScope = {
  role: "EMPLOYEE",
  companyId: "c1",
  siteIds: new Set(),
  orgUnitIds: null,
};

describe("canRoleSendBroadcasts", () => {
  const cases: [PlatformRole, boolean][] = [
    ["COMPANY_ADMIN", true],
    ["SITE_ADMIN", true],
    ["EHS_SPECIALIST", true],
    ["MANAGER", true],
    ["EMPLOYEE", false],
    ["WORKS_COUNCIL", false],
    ["OCCUPATIONAL_PHYSICIAN", false],
    ["SUPER_ADMIN", false],
  ];
  for (const [role, expected] of cases) {
    it(`${role} ${expected ? "may" : "may not"} send`, () => {
      expect(canRoleSendBroadcasts(role)).toBe(expected);
    });
  }
});

describe("company-wide audience", () => {
  it("only a company admin may address the whole company", () => {
    expect(validateAudienceTarget(admin, { scope: "COMPANY" }).ok).toBe(true);
    for (const sender of [siteAdmin, ehs, leader]) {
      const result = validateAudienceTarget(sender, { scope: "COMPANY" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("company-wide-not-allowed");
    }
  });
});

describe("site audience", () => {
  it("a site admin may address their own site", () => {
    expect(
      validateAudienceTarget(siteAdmin, { scope: "SITE", siteId: SITE_A }).ok,
    ).toBe(true);
  });
  it("a site admin may NOT address another site", () => {
    const result = validateAudienceTarget(siteAdmin, {
      scope: "SITE",
      siteId: SITE_B,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside-sites");
  });
  it("a leader has no whole-site audience", () => {
    const result = validateAudienceTarget(leader, {
      scope: "SITE",
      siteId: SITE_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside-org-units");
  });
});

describe("org-unit audience", () => {
  it("a leader may address their own unit", () => {
    expect(
      validateAudienceTarget(leader, {
        scope: "ORG_UNIT",
        orgUnitId: UNIT_MONTAGE,
        resolvedSiteId: SITE_A,
      }).ok,
    ).toBe(true);
  });
  it("a leader may NOT address another department — the §5 check", () => {
    const result = validateAudienceTarget(leader, {
      scope: "ORG_UNIT",
      orgUnitId: UNIT_LAGER,
      resolvedSiteId: SITE_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside-org-units");
  });
  it("EHS may address any unit of their own site", () => {
    expect(
      validateAudienceTarget(ehs, {
        scope: "ORG_UNIT",
        orgUnitId: UNIT_LAGER,
        resolvedSiteId: SITE_A,
      }).ok,
    ).toBe(true);
  });
  it("a unit whose site did not resolve is refused, never assumed", () => {
    const result = validateAudienceTarget(ehs, {
      scope: "ORG_UNIT",
      orgUnitId: "unit-in-another-tenant",
      resolvedSiteId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("target-unresolved");
  });
  it("a unit on another site is refused even for an admin without that site", () => {
    const result = validateAudienceTarget(siteAdmin, {
      scope: "ORG_UNIT",
      orgUnitId: UNIT_LAGER,
      resolvedSiteId: SITE_B,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside-sites");
  });
});

describe("workstation audience", () => {
  it("a leader may address a workstation inside their unit", () => {
    expect(
      validateAudienceTarget(leader, {
        scope: "WORKSTATION",
        workstationId: "ws-1",
        resolvedSiteId: SITE_A,
        resolvedOrgUnitId: UNIT_MONTAGE,
      }).ok,
    ).toBe(true);
  });
  it("a leader may NOT address a workstation in another unit", () => {
    const result = validateAudienceTarget(leader, {
      scope: "WORKSTATION",
      workstationId: "ws-2",
      resolvedSiteId: SITE_A,
      resolvedOrgUnitId: UNIT_LAGER,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside-org-units");
  });
  it("an unplaced workstation is refused for a leader rather than assumed in scope", () => {
    const result = validateAudienceTarget(leader, {
      scope: "WORKSTATION",
      workstationId: "ws-3",
      resolvedSiteId: SITE_A,
      resolvedOrgUnitId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside-org-units");
  });
  it("EHS may address an unplaced workstation on their site", () => {
    expect(
      validateAudienceTarget(ehs, {
        scope: "WORKSTATION",
        workstationId: "ws-3",
        resolvedSiteId: SITE_A,
        resolvedOrgUnitId: null,
      }).ok,
    ).toBe(true);
  });
});

describe("role audience", () => {
  it("a site-wide sender may address a role", () => {
    expect(
      validateAudienceTarget(siteAdmin, { scope: "ROLE", role: "MANAGER" }).ok,
    ).toBe(true);
  });
  it("a leader may not address a role list", () => {
    const result = validateAudienceTarget(leader, {
      scope: "ROLE",
      role: "EMPLOYEE",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("role-audience-not-allowed");
  });
});

describe("validateAudienceTargets", () => {
  it("an employee cannot send anything", () => {
    const result = validateAudienceTargets(employee, [
      { scope: "ORG_UNIT", orgUnitId: UNIT_MONTAGE, resolvedSiteId: SITE_A },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("role-cannot-send");
  });
  it("an empty audience list is a refusal", () => {
    expect(validateAudienceTargets(admin, []).ok).toBe(false);
  });
  it("every target must pass — one bad target fails the set", () => {
    const result = validateAudienceTargets(leader, [
      { scope: "ORG_UNIT", orgUnitId: UNIT_MONTAGE, resolvedSiteId: SITE_A },
      { scope: "ORG_UNIT", orgUnitId: UNIT_LAGER, resolvedSiteId: SITE_A },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("outside-org-units");
  });
  it("accepts several in-scope targets", () => {
    expect(
      validateAudienceTargets(ehs, [
        { scope: "SITE", siteId: SITE_A },
        { scope: "ORG_UNIT", orgUnitId: UNIT_LAGER, resolvedSiteId: SITE_A },
      ]).ok,
    ).toBe(true);
  });
});
