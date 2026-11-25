import { describe, expect, it } from "vitest";
import { isSessionVisible } from "./session-visibility";

const ME = "user-1";
const SOMEONE_ELSE = "user-2";

describe("isSessionVisible", () => {
  it("a company/site-wide viewer sees every session", () => {
    expect(
      isSessionVisible(
        { plannedByUserId: SOMEONE_ELSE, participantOrgUnitIds: ["other"] },
        null,
        ME,
      ),
    ).toBe(true);
  });
  it("a leader sees a session they planned themselves", () => {
    expect(
      isSessionVisible(
        { plannedByUserId: ME, participantOrgUnitIds: [] },
        new Set(["montage"]),
        ME,
      ),
    ).toBe(true);
  });
  it("a leader sees a session touching one of their units", () => {
    expect(
      isSessionVisible(
        {
          plannedByUserId: SOMEONE_ELSE,
          participantOrgUnitIds: ["lager", "montage"],
        },
        new Set(["montage"]),
        ME,
      ),
    ).toBe(true);
  });
  it("a leader does NOT see another unit's session", () => {
    expect(
      isSessionVisible(
        { plannedByUserId: SOMEONE_ELSE, participantOrgUnitIds: ["lager"] },
        new Set(["montage"]),
        ME,
      ),
    ).toBe(false);
  });
  it("participants with no org unit do not make a session visible", () => {
    expect(
      isSessionVisible(
        { plannedByUserId: SOMEONE_ELSE, participantOrgUnitIds: [null, null] },
        new Set(["montage"]),
        ME,
      ),
    ).toBe(false);
  });
  it("an empty scope set sees nothing it did not plan", () => {
    expect(
      isSessionVisible(
        { plannedByUserId: SOMEONE_ELSE, participantOrgUnitIds: ["montage"] },
        new Set(),
        ME,
      ),
    ).toBe(false);
  });
});
