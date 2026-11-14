import { describe, expect, it } from "vitest";
import { scopedCookieName } from "./base-path";

describe("scopedCookieName", () => {
  it("returns the plain name with no base path (production today)", () => {
    // NEXT_PUBLIC_BASE_PATH is unset in the test env.
    expect(scopedCookieName("statura-locale")).toBe("statura-locale");
    expect(scopedCookieName("sld-impersonate")).toBe("sld-impersonate");
  });
});
