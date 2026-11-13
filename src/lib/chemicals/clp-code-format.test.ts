import { describe, expect, it } from "vitest";
import { inferStatementKind, isValidStatementCode } from "./clp-code-format";

describe("isValidStatementCode", () => {
  it("accepts well-formed H codes", () => {
    expect(isValidStatementCode("H", "H225")).toBe(true);
    expect(isValidStatementCode("H", "H300")).toBe(true);
    expect(isValidStatementCode("H", "H360FD")).toBe(true); // trailing letters
    expect(isValidStatementCode("H", "h225")).toBe(true); // normalised
  });
  it("rejects malformed H codes", () => {
    expect(isValidStatementCode("H", "H100")).toBe(false); // first digit must be 2-4
    expect(isValidStatementCode("H", "H25")).toBe(false);
    expect(isValidStatementCode("H", "P225")).toBe(false);
  });
  it("accepts EUH codes incl. a trailing letter", () => {
    expect(isValidStatementCode("EUH", "EUH059")).toBe(true);
    expect(isValidStatementCode("EUH", "EUH208")).toBe(true);
  });
  it("accepts P codes and combined P codes", () => {
    expect(isValidStatementCode("P", "P280")).toBe(true);
    expect(isValidStatementCode("P", "P301+P310")).toBe(true);
    expect(isValidStatementCode("P", "P301+P330+P331")).toBe(true);
  });
  it("rejects a P code with a non-P second element", () => {
    expect(isValidStatementCode("P", "P301+H310")).toBe(false);
  });
});

describe("inferStatementKind", () => {
  it("resolves each shape, EUH before H", () => {
    expect(inferStatementKind("EUH059")).toBe("EUH");
    expect(inferStatementKind("H225")).toBe("H");
    expect(inferStatementKind("P280")).toBe("P");
  });
  it("returns null for an unknown shape, never guesses", () => {
    expect(inferStatementKind("X999")).toBeNull();
    expect(inferStatementKind("")).toBeNull();
  });
});
