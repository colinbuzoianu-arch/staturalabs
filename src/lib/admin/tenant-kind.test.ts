import { describe, expect, it } from "vitest";
import {
  CUSTOMER_TENANT_WHERE,
  countsAsCustomer,
  graceExpired,
  trialDaysLeft,
  trialState,
} from "./tenant-kind";

const now = new Date("2026-11-25T12:00:00Z");
const base = {
  tenantKind: "TRIAL" as const,
  trialExpiresAt: null as Date | null,
  trialLockedAt: null as Date | null,
  trialConvertedAt: null as Date | null,
};

describe("countsAsCustomer", () => {
  it("counts only real customers", () => {
    expect(countsAsCustomer("CUSTOMER")).toBe(true);
    expect(countsAsCustomer("TRIAL")).toBe(false);
    expect(countsAsCustomer("DEMO")).toBe(false);
  });
  it("the query fragment matches the predicate", () => {
    expect(CUSTOMER_TENANT_WHERE.tenantKind).toBe("CUSTOMER");
    expect(countsAsCustomer(CUSTOMER_TENANT_WHERE.tenantKind)).toBe(true);
  });
});

describe("trialState", () => {
  it("a customer is not a trial", () => {
    expect(trialState({ ...base, tenantKind: "CUSTOMER" }, now)).toBe(
      "not-a-trial",
    );
  });
  it("a converted trial reads as converted even as a CUSTOMER", () => {
    expect(
      trialState(
        {
          ...base,
          tenantKind: "CUSTOMER",
          trialConvertedAt: new Date("2026-10-01"),
        },
        now,
      ),
    ).toBe("converted");
  });
  it("a trial with plenty of time is active", () => {
    expect(
      trialState({ ...base, trialExpiresAt: new Date("2026-12-24") }, now),
    ).toBe("active");
  });
  it("a trial inside the 7-day window is expiring soon", () => {
    expect(
      trialState(
        { ...base, trialExpiresAt: new Date("2026-11-29T12:00:00Z") },
        now,
      ),
    ).toBe("expiring-soon");
  });
  it("a trial past its expiry is locked, even without a lock stamp", () => {
    expect(
      trialState(
        { ...base, trialExpiresAt: new Date("2026-11-24T12:00:00Z") },
        now,
      ),
    ).toBe("locked");
  });
  it("an explicit lock stamp wins over the date", () => {
    expect(
      trialState(
        {
          ...base,
          trialExpiresAt: new Date("2026-12-24"),
          trialLockedAt: new Date("2026-11-20"),
        },
        now,
      ),
    ).toBe("locked");
  });
  it("a TRIAL with no expiry is ACTIVE — a missing date must never lock anyone out", () => {
    expect(trialState(base, now)).toBe("active");
  });
});

describe("trialDaysLeft", () => {
  it("counts whole days, rounded up", () => {
    expect(trialDaysLeft(new Date("2026-11-27T11:00:00Z"), now)).toBe(2);
    expect(trialDaysLeft(new Date("2026-11-25T13:00:00Z"), now)).toBe(1);
  });
  it("goes negative once past", () => {
    expect(trialDaysLeft(new Date("2026-11-23T12:00:00Z"), now)).toBe(-2);
  });
  it("is null with no expiry", () => {
    expect(trialDaysLeft(null, now)).toBeNull();
  });
});

describe("graceExpired", () => {
  it("is false without a lock stamp — fail-closed, no proposal", () => {
    expect(graceExpired(null, now)).toBe(false);
  });
  it("is false inside the 30-day grace period", () => {
    expect(graceExpired(new Date("2026-11-10T12:00:00Z"), now)).toBe(false);
  });
  it("is true once the grace period has run", () => {
    expect(graceExpired(new Date("2026-10-20T12:00:00Z"), now)).toBe(true);
  });
  it("honours a custom grace length", () => {
    expect(graceExpired(new Date("2026-11-20T12:00:00Z"), now, 3)).toBe(true);
  });
});
