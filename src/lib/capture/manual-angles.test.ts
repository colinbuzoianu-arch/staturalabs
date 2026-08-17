import { describe, expect, it } from "vitest";
import { COMPUTED_BODY_REGIONS, validateManualAngles } from "./manual-angles";

function completeAngles(overrides: Partial<Record<string, number>> = {}) {
  const base: Record<string, number> = {};
  for (const region of COMPUTED_BODY_REGIONS) base[region] = 10;
  return { ...base, ...overrides };
}

describe("validateManualAngles", () => {
  it("accepts an object with a finite number for every computed region", () => {
    const result = validateManualAngles(completeAngles({ NECK: -12.5 }));
    expect(typeof result).not.toBe("string");
    const angles = result as Record<string, number>;
    expect(angles.NECK).toBe(-12.5);
    expect(Object.keys(angles).sort()).toEqual(
      [...COMPUTED_BODY_REGIONS].sort(),
    );
  });

  it("rejects a non-object value", () => {
    expect(validateManualAngles(null)).toBe("angles must be an object");
    expect(validateManualAngles("nope")).toBe("angles must be an object");
    expect(validateManualAngles(42)).toBe("angles must be an object");
    expect(validateManualAngles(["array"])).toBe("angles must be an object");
  });

  it("rejects a missing region", () => {
    const angles = completeAngles();
    delete angles.NECK;
    const result = validateManualAngles(angles);
    expect(result).toBe("angles.NECK must be a finite number of degrees");
  });

  it("rejects a non-numeric region value", () => {
    const result = validateManualAngles(
      completeAngles({ TRUNK: "12" as unknown as number }),
    );
    expect(result).toBe("angles.TRUNK must be a finite number of degrees");
  });

  it("rejects NaN/Infinity", () => {
    expect(
      validateManualAngles(completeAngles({ SHOULDER_LEFT: Number.NaN })),
    ).toBe("angles.SHOULDER_LEFT must be a finite number of degrees");
    expect(
      validateManualAngles(
        completeAngles({ KNEE_RIGHT: Number.POSITIVE_INFINITY }),
      ),
    ).toBe("angles.KNEE_RIGHT must be a finite number of degrees");
  });

  it("ignores extra keys not in COMPUTED_BODY_REGIONS", () => {
    const result = validateManualAngles(completeAngles({ HIP: 5 }));
    expect(typeof result).not.toBe("string");
    const angles = result as Record<string, number>;
    expect(angles).not.toHaveProperty("HIP");
  });
});
