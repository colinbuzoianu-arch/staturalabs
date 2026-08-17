import { describe, expect, it } from "vitest";
import { exposureThresholdStatus } from "./exposure-threshold-status";

describe("exposureThresholdStatus", () => {
  it("returns within-limits when the value is at or below both thresholds", () => {
    expect(
      exposureThresholdStatus({ value: 79, actionValue: 80, limitValue: 85 }),
    ).toBe("within-limits");
    expect(
      exposureThresholdStatus({ value: 80, actionValue: 80, limitValue: 85 }),
    ).toBe("within-limits"); // exactly at the action value — not yet over it
  });

  it("returns over-action-value between the action value and the limit value", () => {
    expect(
      exposureThresholdStatus({ value: 82, actionValue: 80, limitValue: 85 }),
    ).toBe("over-action-value");
  });

  it("returns over-limit-value once the exposure limit itself is exceeded", () => {
    expect(
      exposureThresholdStatus({ value: 89, actionValue: 80, limitValue: 85 }),
    ).toBe("over-limit-value");
  });

  it("still flags over-limit-value even when no action value was recorded", () => {
    expect(
      exposureThresholdStatus({ value: 92, actionValue: null, limitValue: 87 }),
    ).toBe("over-limit-value");
  });

  it("returns within-limits when neither threshold is recorded", () => {
    expect(
      exposureThresholdStatus({
        value: 1000,
        actionValue: null,
        limitValue: null,
      }),
    ).toBe("within-limits");
  });

  it("prioritizes over-limit-value over over-action-value when both are exceeded", () => {
    expect(
      exposureThresholdStatus({ value: 90, actionValue: 80, limitValue: 85 }),
    ).toBe("over-limit-value");
  });
});
