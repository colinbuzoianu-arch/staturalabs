import { describe, expect, it } from "vitest";
import { isCmr1A1B, isCmrAny } from "./cmr";

const none = {
  carcinogenicCategory: "NONE",
  mutagenicCategory: "NONE",
  reprotoxicCategory: "NONE",
} as const;

describe("isCmr1A1B", () => {
  it("true for any 1A/1B", () => {
    expect(isCmr1A1B({ ...none, carcinogenicCategory: "CAT_1B" })).toBe(true);
    expect(isCmr1A1B({ ...none, reprotoxicCategory: "CAT_1A" })).toBe(true);
  });
  it("false for cat 2 or none", () => {
    expect(isCmr1A1B({ ...none, mutagenicCategory: "CAT_2" })).toBe(false);
    expect(isCmr1A1B(none)).toBe(false);
  });
});

describe("isCmrAny", () => {
  it("true for any non-NONE category incl. cat 2", () => {
    expect(isCmrAny({ ...none, mutagenicCategory: "CAT_2" })).toBe(true);
  });
  it("false when all NONE", () => {
    expect(isCmrAny(none)).toBe(false);
  });
});
