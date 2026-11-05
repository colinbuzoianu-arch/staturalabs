import { describe, expect, it } from "vitest";
import {
  type NotificationRuleShape,
  parseDurationDays,
  resolveNotificationDeadline,
} from "./notification-deadline";

const r = (over: Partial<NotificationRuleShape>): NotificationRuleShape => ({
  incidentType: "ARBEITSUNFALL",
  appliesToFatalOrMass: false,
  deadline: "P5D",
  immediate: false,
  asSoonAsPossible: false,
  thresholdText: "x",
  clockStartsText: null,
  legalReferenceId: "ref",
  ...over,
});

const AT = [
  r({ incidentType: "ARBEITSUNFALL", deadline: "P5D" }),
  r({ incidentType: "BERUFSKRANKHEIT_VERDACHT", deadline: "P5D" }),
];
const DE = [
  r({ incidentType: "ARBEITSUNFALL", deadline: "P3D" }),
  r({
    incidentType: "ARBEITSUNFALL",
    appliesToFatalOrMass: true,
    deadline: null,
    immediate: true,
  }),
];
const CH = [
  r({ incidentType: "ARBEITSUNFALL", deadline: null, asSoonAsPossible: true }),
];

const KNOWN = new Date("2026-11-05T09:00:00.000Z");

describe("resolveNotificationDeadline (P10d)", () => {
  it("AT 5-day deadline from the accident date", () => {
    const d = resolveNotificationDeadline(AT, "ARBEITSUNFALL", KNOWN);
    expect(d.kind).toBe("deadline");
    if (d.kind === "deadline") {
      expect(d.durationDays).toBe(5);
      expect(d.dueAt.toISOString()).toBe("2026-11-10T09:00:00.000Z");
    }
  });

  it("DE 3-day deadline for the standard accident", () => {
    const d = resolveNotificationDeadline(DE, "ARBEITSUNFALL", KNOWN);
    expect(d.kind).toBe("deadline");
    if (d.kind === "deadline") expect(d.durationDays).toBe(3);
  });

  it("DE fatal/mass case resolves to immediate (not a 0-day deadline)", () => {
    const d = resolveNotificationDeadline(DE, "ARBEITSUNFALL", KNOWN, {
      fatalOrMass: true,
    });
    expect(d.kind).toBe("immediate");
  });

  it("DE standard rule still wins when not fatal/mass", () => {
    const d = resolveNotificationDeadline(DE, "ARBEITSUNFALL", KNOWN, {
      fatalOrMass: false,
    });
    expect(d.kind).toBe("deadline");
  });

  it("CH resolves to asSoonAsPossible (no fixed count)", () => {
    const d = resolveNotificationDeadline(CH, "ARBEITSUNFALL", KNOWN);
    expect(d.kind).toBe("asSoonAsPossible");
  });

  it("fail-closed: a type with no rule returns none (no cross-country borrow)", () => {
    expect(resolveNotificationDeadline(AT, "BRAND", KNOWN).kind).toBe("none");
    expect(resolveNotificationDeadline([], "ARBEITSUNFALL", KNOWN).kind).toBe(
      "none",
    );
  });

  it("fail-closed: an unparseable deadline returns none, never 0 days", () => {
    const bad = [r({ deadline: "5 days" })];
    expect(resolveNotificationDeadline(bad, "ARBEITSUNFALL", KNOWN).kind).toBe(
      "none",
    );
  });

  it("parseDurationDays handles P<n>D and rejects the rest", () => {
    expect(parseDurationDays("P5D")).toBe(5);
    expect(parseDurationDays("P3D")).toBe(3);
    expect(parseDurationDays(null)).toBeNull();
    expect(parseDurationDays("P1W")).toBeNull();
  });
});
