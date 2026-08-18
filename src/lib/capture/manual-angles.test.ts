import { describe, expect, it } from "vitest";
import {
  MANUAL_ENTRY_BODY_REGIONS,
  resolveEntryMode,
  validateManualAngles,
} from "./manual-angles";

function completeAngles(overrides: Partial<Record<string, number>> = {}) {
  const base: Record<string, number> = {};
  for (const region of MANUAL_ENTRY_BODY_REGIONS) base[region] = 10;
  return { ...base, ...overrides };
}

describe("validateManualAngles", () => {
  it("accepts an object with a finite number for every manual-entry region, defaulting entryMode to degrees", () => {
    const result = validateManualAngles(completeAngles({ NECK: -12.5 }));
    expect(typeof result).not.toBe("string");
    const angles = result as Record<string, unknown>;
    expect(angles.NECK).toBe(-12.5);
    expect(angles.entryMode).toBe("degrees");
    expect(
      Object.keys(angles)
        .filter((k) => k !== "entryMode")
        .sort(),
    ).toEqual([...MANUAL_ENTRY_BODY_REGIONS].sort());
  });

  it("rejects a non-object value", () => {
    expect(validateManualAngles(null)).toBe("angles must be an object");
    expect(validateManualAngles("nope")).toBe("angles must be an object");
    expect(validateManualAngles(42)).toBe("angles must be an object");
    expect(validateManualAngles(["array"])).toBe("angles must be an object");
  });

  it("accepts a partial entry — B11 no longer requires every region", () => {
    const result = validateManualAngles({ TRUNK: 25, NECK: 5 });
    expect(typeof result).not.toBe("string");
    const angles = result as Record<string, unknown>;
    expect(angles.TRUNK).toBe(25);
    expect(angles.NECK).toBe(5);
    expect(angles).not.toHaveProperty("SHOULDER_LEFT");
    expect(angles.entryMode).toBe("degrees");
  });

  it("rejects zero regions — at least one must be present", () => {
    expect(validateManualAngles({})).toBe(
      "at least one region must be entered",
    );
    expect(validateManualAngles({ entryMode: "category" })).toBe(
      "at least one region must be entered",
    );
  });

  it('accepts entryMode: "category" and passes it through', () => {
    const result = validateManualAngles({ TRUNK: 10, entryMode: "category" });
    expect(typeof result).not.toBe("string");
    expect((result as Record<string, unknown>).entryMode).toBe("category");
  });

  it("rejects an invalid entryMode value", () => {
    expect(validateManualAngles({ TRUNK: 10, entryMode: "precise" })).toBe(
      'entryMode must be "category" or "degrees"',
    );
  });

  it("rejects a non-numeric region value", () => {
    const result = validateManualAngles({ TRUNK: "12" });
    expect(result).toBe("angles.TRUNK must be a finite number of degrees");
  });

  it("rejects NaN/Infinity", () => {
    expect(validateManualAngles({ SHOULDER_LEFT: Number.NaN })).toBe(
      "angles.SHOULDER_LEFT must be a finite number of degrees",
    );
    expect(validateManualAngles({ KNEE_RIGHT: Number.POSITIVE_INFINITY })).toBe(
      "angles.KNEE_RIGHT must be a finite number of degrees",
    );
  });

  it("rejects a missing wrist region when every OTHER region is present but wrist is explicitly invalid", () => {
    const angles = completeAngles({ WRIST_LEFT: "bad" as unknown as number });
    expect(validateManualAngles(angles)).toBe(
      "angles.WRIST_LEFT must be a finite number of degrees",
    );
  });

  it("ignores extra keys not in MANUAL_ENTRY_BODY_REGIONS", () => {
    const result = validateManualAngles(completeAngles({ HIP: 5 }));
    expect(typeof result).not.toBe("string");
    const angles = result as Record<string, unknown>;
    expect(angles).not.toHaveProperty("HIP");
  });
});

describe("resolveEntryMode", () => {
  it('returns "category" only when entryMode is exactly "category"', () => {
    expect(resolveEntryMode({ entryMode: "category" })).toBe("category");
  });

  it('defaults to "degrees" for a historical row with no entryMode key', () => {
    expect(resolveEntryMode({})).toBe("degrees");
    expect(resolveEntryMode(null)).toBe("degrees");
    expect(resolveEntryMode(undefined)).toBe("degrees");
  });

  it('defaults to "degrees" for any unrecognized entryMode value', () => {
    expect(resolveEntryMode({ entryMode: "precise" })).toBe("degrees");
  });
});
