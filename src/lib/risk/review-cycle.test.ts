import { describe, expect, it } from "vitest";
import { computeNextReviewDate, isReviewDue } from "./review-cycle";

describe("computeNextReviewDate", () => {
  it("adds whole months", () => {
    const next = computeNextReviewDate(new Date("2026-01-15T00:00:00Z"), 12);
    expect(next?.toISOString().slice(0, 10)).toBe("2027-01-15");
  });
  it("clamps the day to the target month length", () => {
    const next = computeNextReviewDate(new Date("2026-01-31T00:00:00Z"), 1);
    expect(next?.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("returns null for no / non-positive interval", () => {
    expect(computeNextReviewDate(new Date("2026-01-01Z"), null)).toBeNull();
    expect(computeNextReviewDate(new Date("2026-01-01Z"), 0)).toBeNull();
  });
});

describe("isReviewDue", () => {
  const now = new Date("2026-11-03T00:00:00Z");
  it("is true when flagged required regardless of date", () => {
    expect(isReviewDue(null, true, now)).toBe(true);
    expect(isReviewDue(new Date("2030-01-01Z"), true, now)).toBe(true);
  });
  it("is true within the lead window", () => {
    expect(isReviewDue(new Date("2026-11-20Z"), false, now, 30)).toBe(true);
  });
  it("is true when past", () => {
    expect(isReviewDue(new Date("2026-01-01Z"), false, now, 30)).toBe(true);
  });
  it("is false well in the future", () => {
    expect(isReviewDue(new Date("2027-06-01Z"), false, now, 30)).toBe(false);
  });
  it("is false with no date and not flagged", () => {
    expect(isReviewDue(null, false, now)).toBe(false);
  });
});
