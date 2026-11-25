import { describe, expect, it } from "vitest";
import {
  checkTrialUserLimit,
  TRIAL_AI_CALL_CAP_DEFAULT,
  TRIAL_MAX_USERS_DEFAULT,
  trialAiCallCap,
  trialUserLimit,
} from "./trial-limits";

describe("trialUserLimit", () => {
  it("limits a trial to the documented default", () => {
    expect(trialUserLimit("TRIAL", undefined)).toBe(TRIAL_MAX_USERS_DEFAULT);
    expect(TRIAL_MAX_USERS_DEFAULT).toBe(10);
  });
  it("never limits a customer or the demo tenant", () => {
    expect(trialUserLimit("CUSTOMER", "3")).toBeNull();
    expect(trialUserLimit("DEMO", "3")).toBeNull();
  });
  it("honours the configured value", () => {
    expect(trialUserLimit("TRIAL", "25")).toBe(25);
  });
  it("ignores nonsense configuration and keeps the default", () => {
    for (const bad of ["", "nope", "0", "-5", "3.7.1"]) {
      expect(trialUserLimit("TRIAL", bad)).toBe(TRIAL_MAX_USERS_DEFAULT);
    }
  });
});

describe("trialAiCallCap", () => {
  it("caps a trial and nothing else", () => {
    expect(trialAiCallCap("TRIAL", undefined)).toBe(TRIAL_AI_CALL_CAP_DEFAULT);
    expect(trialAiCallCap("CUSTOMER", undefined)).toBeNull();
  });
  it("is the sum of the plan's 25 extractions + 50 drafts", () => {
    expect(TRIAL_AI_CALL_CAP_DEFAULT).toBe(75);
  });
  it("honours the configured value", () => {
    expect(trialAiCallCap("TRIAL", "10")).toBe(10);
  });
});

describe("checkTrialUserLimit", () => {
  it("lets a customer add any number of users", () => {
    expect(checkTrialUserLimit("CUSTOMER", 500).ok).toBe(true);
  });
  it("lets a trial add users below the limit", () => {
    expect(checkTrialUserLimit("TRIAL", 9, "10").ok).toBe(true);
  });
  it("refuses AT the limit — 'up to 10' means 10, not 11", () => {
    const result = checkTrialUserLimit("TRIAL", 10, "10");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.limit).toBe(10);
      expect(result.current).toBe(10);
    }
  });
  it("refuses above the limit too (an existing over-limit tenant cannot grow)", () => {
    expect(checkTrialUserLimit("TRIAL", 14, "10").ok).toBe(false);
  });
});
