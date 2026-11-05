import { describe, expect, it } from "vitest";
import { withMinimumGroupSize } from "./min-group-size";

describe("withMinimumGroupSize (§3.4)", () => {
  it("suppresses below the default group size of 5", () => {
    expect(withMinimumGroupSize(42, 4).suppressed).toBe(true);
    expect(withMinimumGroupSize(42, 0).suppressed).toBe(true);
  });

  it("passes the value at or above the group size", () => {
    const r = withMinimumGroupSize(42, 5);
    expect(r.suppressed).toBe(false);
    if (!r.suppressed) expect(r.value).toBe(42);
  });

  it("honours a custom group size", () => {
    expect(withMinimumGroupSize(1, 9, 10).suppressed).toBe(true);
    expect(withMinimumGroupSize(1, 10, 10).suppressed).toBe(false);
  });

  it("always reports the group count (for an honest 'n < 5' message)", () => {
    expect(withMinimumGroupSize(0, 3).groupCount).toBe(3);
  });
});
