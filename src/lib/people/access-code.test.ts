import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  accessCodeExpiry,
  accessCodeUsability,
  formatAccessCode,
  generateAccessCode,
  hashAccessCode,
  isSyntheticEmployeeEmail,
  normalizeAccessCode,
  syntheticEmployeeEmail,
} from "./access-code";

describe("generateAccessCode", () => {
  it("uses only the unambiguous alphabet, at the configured length", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateAccessCode();
      expect(code).toHaveLength(ACCESS_CODE_LENGTH);
      for (const ch of code) expect(ACCESS_CODE_ALPHABET).toContain(ch);
    }
  });
  it("never emits the look-alike characters I L O U 0 1", () => {
    const joined = Array.from({ length: 200 }, () => generateAccessCode()).join(
      "",
    );
    for (const ch of ["I", "L", "O", "U", "0", "1"]) {
      expect(joined).not.toContain(ch);
    }
  });
});

describe("normalizeAccessCode", () => {
  it("accepts what a person plausibly types off a printed sheet", () => {
    expect(normalizeAccessCode("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(normalizeAccessCode(" ABCDE FGHJK ")).toBe("ABCDEFGHJK");
  });
  it("does NOT map look-alikes to alphabet members", () => {
    // A typed "O" stays an O (not 0) — it simply will not match any hash.
    expect(normalizeAccessCode("O0IL")).toBe("O0IL");
  });
});

describe("hashAccessCode", () => {
  it("is stable, normalizing, and not the plaintext", () => {
    const h = hashAccessCode("ABCDE-FGHJK");
    expect(h).toBe(hashAccessCode("abcdefghjk"));
    expect(h).toHaveLength(64);
    expect(h).not.toContain("ABCDE");
  });
  it("differs for different codes", () => {
    expect(hashAccessCode("ABCDEFGHJK")).not.toBe(hashAccessCode("ABCDEFGHJM"));
  });
});

describe("formatAccessCode", () => {
  it("prints two groups", () => {
    expect(formatAccessCode("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
  });
});

describe("accessCodeUsability", () => {
  const now = new Date("2026-11-25T10:00:00Z");
  const future = new Date("2026-12-09T10:00:00Z");
  it("accepts an unused, unrevoked, unexpired code", () => {
    expect(
      accessCodeUsability(
        { expiresAt: future, usedAt: null, revokedAt: null },
        now,
      ),
    ).toEqual({ usable: true });
  });
  it("rejects a used code", () => {
    expect(
      accessCodeUsability(
        { expiresAt: future, usedAt: new Date(), revokedAt: null },
        now,
      ),
    ).toEqual({ usable: false, reason: "used" });
  });
  it("rejects a revoked code", () => {
    expect(
      accessCodeUsability(
        { expiresAt: future, usedAt: null, revokedAt: new Date() },
        now,
      ),
    ).toEqual({ usable: false, reason: "revoked" });
  });
  it("rejects an expired code, boundary inclusive", () => {
    expect(
      accessCodeUsability(
        { expiresAt: now, usedAt: null, revokedAt: null },
        now,
      ).usable,
    ).toBe(false);
  });
});

describe("accessCodeExpiry", () => {
  it("defaults to 14 days", () => {
    expect(
      accessCodeExpiry(new Date("2026-11-25T00:00:00Z")).toISOString(),
    ).toBe("2026-12-09T00:00:00.000Z");
  });
});

describe("syntheticEmployeeEmail", () => {
  it("is on the reserved .invalid TLD and carries the company", () => {
    const a = syntheticEmployeeEmail("cmpA", "D-1001");
    expect(a).toBe("pn-d1001.cmpa@employee.sld.invalid");
    expect(isSyntheticEmployeeEmail(a)).toBe(true);
    expect(a).not.toBe(syntheticEmployeeEmail("cmpB", "D-1001"));
  });
  it("recognises a real address as not synthetic", () => {
    expect(isSyntheticEmployeeEmail("anna@example.com")).toBe(false);
  });
});
