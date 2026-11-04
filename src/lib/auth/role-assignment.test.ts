import { describe, expect, it } from "vitest";
import { validateScopeShape } from "./role-assignment";

describe("validateScopeShape", () => {
  it("requires a target for SITE and ORG_UNIT", () => {
    expect(() => validateScopeShape("SITE", null)).toThrow();
    expect(() => validateScopeShape("ORG_UNIT", null)).toThrow();
    expect(() => validateScopeShape("SITE", "s1")).not.toThrow();
    expect(() => validateScopeShape("ORG_UNIT", "o1")).not.toThrow();
  });
  it("forbids a target for COMPANY and SELF", () => {
    expect(() => validateScopeShape("COMPANY", "x")).toThrow();
    expect(() => validateScopeShape("SELF", "x")).toThrow();
    expect(() => validateScopeShape("COMPANY", null)).not.toThrow();
    expect(() => validateScopeShape("SELF", null)).not.toThrow();
  });
});
