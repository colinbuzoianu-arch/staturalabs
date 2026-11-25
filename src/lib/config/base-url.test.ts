import { describe, expect, it } from "vitest";
import { appBaseUrl, appUrl } from "./base-url";

describe("appBaseUrl", () => {
  it("is null when unconfigured — callers must not invent a domain", () => {
    expect(appBaseUrl(undefined)).toBeNull();
    expect(appBaseUrl("")).toBeNull();
    expect(appBaseUrl("   ")).toBeNull();
  });
  it("strips trailing slashes and appends the base path", () => {
    // NEXT_PUBLIC_BASE_PATH is unset in the test env → BASE_PATH "".
    expect(appBaseUrl("https://staturalabs.com/")).toBe(
      "https://staturalabs.com",
    );
    expect(appBaseUrl("https://staturalabs.com")).toBe(
      "https://staturalabs.com",
    );
  });
});

describe("appUrl", () => {
  it("joins the path, with or without a leading slash", () => {
    expect(appUrl("/login", "https://staturalabs.com")).toBe(
      "https://staturalabs.com/login",
    );
    expect(appUrl("login", "https://staturalabs.com")).toBe(
      "https://staturalabs.com/login",
    );
  });
  it("is null when unconfigured", () => {
    expect(appUrl("/login", undefined)).toBeNull();
  });
});
