import { describe, expect, it } from "vitest";
import { isRetentionMatured } from "./retention";

const now = new Date("2026-11-25T12:00:00Z");

describe("isRetentionMatured", () => {
  it("is not matured before the period has run", () => {
    expect(
      isRetentionMatured(new Date("2024-01-01T00:00:00Z"), "P5Y", now),
    ).toBe(false);
  });
  it("is matured once the period has run", () => {
    expect(
      isRetentionMatured(new Date("2021-11-24T00:00:00Z"), "P5Y", now),
    ).toBe(true);
  });
  it("is matured exactly on the boundary day", () => {
    expect(
      isRetentionMatured(new Date("2021-11-25T12:00:00Z"), "P5Y", now),
    ).toBe(true);
  });
  it("handles a month period", () => {
    expect(
      isRetentionMatured(new Date("2026-05-01T00:00:00Z"), "P6M", now),
    ).toBe(true);
    expect(
      isRetentionMatured(new Date("2026-07-01T00:00:00Z"), "P6M", now),
    ).toBe(false);
  });
  it("never matures an unpublished message", () => {
    expect(isRetentionMatured(null, "P5Y", now)).toBe(false);
  });
  it("fails CLOSED on an unparseable period — deletion is irreversible", () => {
    for (const bad of ["", "5Y", "P", "P0Y", "forever", "P1W"]) {
      expect(
        isRetentionMatured(new Date("2000-01-01T00:00:00Z"), bad, now),
        `period ${bad} must not mature anything`,
      ).toBe(false);
    }
  });
  it("tolerates surrounding whitespace", () => {
    expect(
      isRetentionMatured(new Date("2019-01-01T00:00:00Z"), " P5Y ", now),
    ).toBe(true);
  });
});
