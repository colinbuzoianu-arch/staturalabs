import { describe, expect, it } from "vitest";
import { substanceSdsAlerts } from "./alerts";

const now = new Date("2026-11-04Z");

describe("substanceSdsAlerts", () => {
  it("no alerts when not in active use and no SDS", () => {
    expect(
      substanceSdsAlerts({
        hasActiveUse: false,
        sdsList: [],
        siteRequiresDe: true,
        now,
        staleYears: 2,
      }),
    ).toEqual([]);
  });
  it("no-current-sds when in use with no current SDS", () => {
    expect(
      substanceSdsAlerts({
        hasActiveUse: true,
        sdsList: [{ language: "de", revisionDate: now, supersededAt: now }],
        siteRequiresDe: true,
        now,
        staleYears: 2,
      }),
    ).toEqual(["no-current-sds"]);
  });
  it("missing-de-sds when in use with only a non-German current SDS", () => {
    expect(
      substanceSdsAlerts({
        hasActiveUse: true,
        sdsList: [{ language: "en", revisionDate: now, supersededAt: null }],
        siteRequiresDe: true,
        now,
        staleYears: 2,
      }),
    ).toEqual(["missing-de-sds"]);
  });
  it("accepts de-AT as German", () => {
    expect(
      substanceSdsAlerts({
        hasActiveUse: true,
        sdsList: [{ language: "de-AT", revisionDate: now, supersededAt: null }],
        siteRequiresDe: true,
        now,
        staleYears: 2,
      }),
    ).toEqual([]);
  });
  it("stale-sds when the current SDS is older than staleYears", () => {
    expect(
      substanceSdsAlerts({
        hasActiveUse: true,
        sdsList: [
          {
            language: "de",
            revisionDate: new Date("2020-01-01Z"),
            supersededAt: null,
          },
        ],
        siteRequiresDe: true,
        now,
        staleYears: 2,
      }),
    ).toEqual(["stale-sds"]);
  });
  it("does not require DE for a non-DE/AT site", () => {
    expect(
      substanceSdsAlerts({
        hasActiveUse: true,
        sdsList: [{ language: "en", revisionDate: now, supersededAt: null }],
        siteRequiresDe: false,
        now,
        staleYears: 2,
      }),
    ).toEqual([]);
  });
});
