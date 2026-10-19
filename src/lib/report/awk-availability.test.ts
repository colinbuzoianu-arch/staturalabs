import { describe, expect, it } from "vitest";
import { resolveAwkCountryPack } from "./awk-availability";

describe("resolveAwkCountryPack (fail-closed country gate)", () => {
  it("returns the AT pack (verified + has an AWK template)", () => {
    const pack = resolveAwkCountryPack("AT");
    expect(pack).not.toBeNull();
    expect(pack?.environmental?.awkTemplateVariant).toBe("awg2002-v1");
  });

  it("returns null for DE and CH (no verified environmental frame yet)", () => {
    expect(resolveAwkCountryPack("DE")).toBeNull();
    expect(resolveAwkCountryPack("CH")).toBeNull();
  });

  it("returns null for RO (no marketing country at all — no silent guess)", () => {
    expect(resolveAwkCountryPack("RO")).toBeNull();
  });
});
