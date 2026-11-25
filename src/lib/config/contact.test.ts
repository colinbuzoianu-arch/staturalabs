import { describe, expect, it } from "vitest";
import {
  trialContactAddress,
  trialContactMailto,
  trialNotifyAddress,
} from "./contact";

describe("trialContactAddress / trialNotifyAddress", () => {
  it("are null when unconfigured — a link is omitted, never guessed", () => {
    expect(trialContactAddress(undefined)).toBeNull();
    expect(trialContactAddress("")).toBeNull();
    expect(trialNotifyAddress(undefined)).toBeNull();
  });
  it("reject a value that is not an address", () => {
    expect(trialContactAddress("not-an-address")).toBeNull();
  });
  it("trim a configured address", () => {
    expect(trialContactAddress("  hallo@example.org ")).toBe(
      "hallo@example.org",
    );
  });
});

describe("trialContactMailto", () => {
  it("is null without a configured address", () => {
    expect(trialContactMailto("Beispiel GmbH", undefined)).toBeNull();
  });
  it("carries a pre-filled subject naming the tenant", () => {
    const link = trialContactMailto("Beispiel GmbH", "hallo@example.org");
    expect(link).toContain("mailto:hallo@example.org");
    expect(link).toContain("Testzugang");
    // The company name is URL-encoded, so a space never breaks the link.
    expect(link).toContain("Beispiel%20GmbH");
  });
});
