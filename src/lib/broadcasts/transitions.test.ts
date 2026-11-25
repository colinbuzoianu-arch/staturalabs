import { describe, expect, it } from "vitest";
import {
  BROADCAST_STATUS_TRANSITIONS,
  validateBroadcastPublishable,
  validateBroadcastTransition,
} from "./transitions";

describe("validateBroadcastTransition", () => {
  it("allows DRAFT → PUBLISHED and PUBLISHED → ARCHIVED", () => {
    expect(validateBroadcastTransition("DRAFT", "PUBLISHED").ok).toBe(true);
    expect(validateBroadcastTransition("PUBLISHED", "ARCHIVED").ok).toBe(true);
  });
  it("has no un-publish: PUBLISHED → DRAFT is refused", () => {
    const result = validateBroadcastTransition("PUBLISHED", "DRAFT");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("PUBLISHED → DRAFT");
  });
  it("treats ARCHIVED as terminal", () => {
    expect(BROADCAST_STATUS_TRANSITIONS.ARCHIVED).toEqual([]);
    const result = validateBroadcastTransition("ARCHIVED", "PUBLISHED");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("terminal");
  });
  it("refuses a self-transition", () => {
    expect(validateBroadcastTransition("DRAFT", "DRAFT").ok).toBe(false);
    expect(validateBroadcastTransition("PUBLISHED", "PUBLISHED").ok).toBe(
      false,
    );
  });
  it("skipping DRAFT → ARCHIVED is refused", () => {
    expect(validateBroadcastTransition("DRAFT", "ARCHIVED").ok).toBe(false);
  });
});

describe("validateBroadcastPublishable", () => {
  const now = new Date("2026-11-25T10:00:00Z");
  const base = {
    title: "Sicherheitsinformation",
    body: "<p>Bitte Schutzbrille tragen.</p>",
    audienceCount: 1,
    requiresConfirmation: false,
    confirmationDueAt: null as Date | null,
  };

  it("accepts a complete broadcast", () => {
    expect(validateBroadcastPublishable(base, now).ok).toBe(true);
  });
  it("refuses an empty title or body", () => {
    expect(validateBroadcastPublishable({ ...base, title: "  " }, now).ok).toBe(
      false,
    );
    expect(validateBroadcastPublishable({ ...base, body: "" }, now).ok).toBe(
      false,
    );
  });
  it("refuses a broadcast with no audience — the dangerous silent case", () => {
    const result = validateBroadcastPublishable(
      { ...base, audienceCount: 0 },
      now,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("audience");
  });
  it("refuses a confirmation deadline in the past", () => {
    const result = validateBroadcastPublishable(
      {
        ...base,
        requiresConfirmation: true,
        confirmationDueAt: new Date("2026-11-24T10:00:00Z"),
      },
      now,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("future");
  });
  it("accepts a future deadline when confirmation is required", () => {
    expect(
      validateBroadcastPublishable(
        {
          ...base,
          requiresConfirmation: true,
          confirmationDueAt: new Date("2026-12-01T10:00:00Z"),
        },
        now,
      ).ok,
    ).toBe(true);
  });
  it("refuses a deadline without a confirmation requirement", () => {
    expect(
      validateBroadcastPublishable(
        {
          ...base,
          requiresConfirmation: false,
          confirmationDueAt: new Date("2026-12-01T10:00:00Z"),
        },
        now,
      ).ok,
    ).toBe(false);
  });
});
