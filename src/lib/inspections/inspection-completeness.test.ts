import { describe, expect, it } from "vitest";
import {
  type AnswerShape,
  canCompleteInspection,
  isAnswerAnswered,
  unansweredRequiredCount,
} from "./inspection-completeness";

const blank: AnswerShape = {
  answerType: "YES_NO_NA",
  required: true,
  valueYesNoNa: null,
  valueNumber: null,
  valueText: null,
  valueChoice: null,
  documentId: null,
};

describe("isAnswerAnswered", () => {
  it("YES_NO_NA counts NA as answered", () => {
    expect(isAnswerAnswered({ ...blank, valueYesNoNa: "NA" })).toBe(true);
    expect(isAnswerAnswered({ ...blank, valueYesNoNa: null })).toBe(false);
  });

  it("NUMBER/SCALE need a number, including zero", () => {
    expect(
      isAnswerAnswered({ ...blank, answerType: "NUMBER", valueNumber: 0 }),
    ).toBe(true);
    expect(
      isAnswerAnswered({ ...blank, answerType: "SCALE", valueNumber: null }),
    ).toBe(false);
  });

  it("TEXT rejects whitespace-only", () => {
    expect(
      isAnswerAnswered({ ...blank, answerType: "TEXT", valueText: "  " }),
    ).toBe(false);
    expect(
      isAnswerAnswered({ ...blank, answerType: "TEXT", valueText: "ok" }),
    ).toBe(true);
  });

  it("CHOICE and FILE need their value", () => {
    expect(
      isAnswerAnswered({ ...blank, answerType: "CHOICE", valueChoice: "A" }),
    ).toBe(true);
    expect(
      isAnswerAnswered({ ...blank, answerType: "FILE", documentId: "d1" }),
    ).toBe(true);
    expect(isAnswerAnswered({ ...blank, answerType: "FILE" })).toBe(false);
  });
});

describe("canCompleteInspection", () => {
  it("is true only when every required question is answered", () => {
    const answers: AnswerShape[] = [
      { ...blank, valueYesNoNa: "YES" },
      { ...blank, required: false }, // optional, unanswered — fine
      { ...blank, answerType: "NUMBER", valueNumber: 3 },
    ];
    expect(canCompleteInspection(answers)).toBe(true);
    expect(unansweredRequiredCount(answers)).toBe(0);
  });

  it("is false while a required question is blank", () => {
    const answers: AnswerShape[] = [
      { ...blank, valueYesNoNa: "YES" },
      { ...blank }, // required, blank
    ];
    expect(canCompleteInspection(answers)).toBe(false);
    expect(unansweredRequiredCount(answers)).toBe(1);
  });

  it("an empty inspection is trivially complete", () => {
    expect(canCompleteInspection([])).toBe(true);
  });
});
