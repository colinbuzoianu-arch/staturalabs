import { describe, expect, it } from "vitest";
import { isOperatingInstructionReviewRequired } from "./operating-instruction";

describe("isOperatingInstructionReviewRequired", () => {
  const based = new Date("2024-01-01Z");
  it("false for a draft", () => {
    expect(
      isOperatingInstructionReviewRequired(
        { status: "DRAFT", basedOnSdsRevisionDate: based },
        new Date("2026-01-01Z"),
      ),
    ).toBe(false);
  });
  it("true when the current SDS is newer than the basis", () => {
    expect(
      isOperatingInstructionReviewRequired(
        { status: "APPROVED", basedOnSdsRevisionDate: based },
        new Date("2026-01-01Z"),
      ),
    ).toBe(true);
  });
  it("false when the current SDS is not newer", () => {
    expect(
      isOperatingInstructionReviewRequired(
        { status: "APPROVED", basedOnSdsRevisionDate: based },
        based,
      ),
    ).toBe(false);
  });
  it("true when approved from no basis but an SDS now exists", () => {
    expect(
      isOperatingInstructionReviewRequired(
        { status: "APPROVED", basedOnSdsRevisionDate: null },
        new Date("2026-01-01Z"),
      ),
    ).toBe(true);
  });
  it("false when there is no current SDS", () => {
    expect(
      isOperatingInstructionReviewRequired(
        { status: "APPROVED", basedOnSdsRevisionDate: based },
        null,
      ),
    ).toBe(false);
  });
});
