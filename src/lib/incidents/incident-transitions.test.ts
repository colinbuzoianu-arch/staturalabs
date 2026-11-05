import { describe, expect, it } from "vitest";
import type { IncidentStatus } from "@/generated/prisma/enums";
import {
  canTransitionIncident,
  INCIDENT_TRANSITIONS,
} from "./incident-transitions";

describe("incident status transitions (P10a)", () => {
  it("allows the forward happy path", () => {
    expect(canTransitionIncident("REPORTED", "TRIAGED")).toBe(true);
    expect(canTransitionIncident("TRIAGED", "UNDER_INVESTIGATION")).toBe(true);
    expect(
      canTransitionIncident("UNDER_INVESTIGATION", "ACTIONS_PENDING"),
    ).toBe(true);
    expect(canTransitionIncident("ACTIONS_PENDING", "CLOSED")).toBe(true);
  });

  it("allows triage to short-circuit to actions or closure", () => {
    expect(canTransitionIncident("TRIAGED", "ACTIONS_PENDING")).toBe(true);
    expect(canTransitionIncident("TRIAGED", "CLOSED")).toBe(true);
    expect(canTransitionIncident("UNDER_INVESTIGATION", "CLOSED")).toBe(true);
  });

  it("allows exactly one reopen: CLOSED -> ACTIONS_PENDING", () => {
    expect(canTransitionIncident("CLOSED", "ACTIONS_PENDING")).toBe(true);
    expect(canTransitionIncident("CLOSED", "REPORTED")).toBe(false);
    expect(canTransitionIncident("CLOSED", "UNDER_INVESTIGATION")).toBe(false);
  });

  it("rejects skips and illegal reverts", () => {
    expect(canTransitionIncident("REPORTED", "UNDER_INVESTIGATION")).toBe(
      false,
    );
    expect(canTransitionIncident("REPORTED", "CLOSED")).toBe(false);
    expect(canTransitionIncident("UNDER_INVESTIGATION", "TRIAGED")).toBe(false);
    expect(canTransitionIncident("ACTIONS_PENDING", "REPORTED")).toBe(false);
  });

  it("is total over every status (no missing key)", () => {
    const all: IncidentStatus[] = [
      "REPORTED",
      "TRIAGED",
      "UNDER_INVESTIGATION",
      "ACTIONS_PENDING",
      "CLOSED",
    ];
    for (const s of all) {
      expect(Array.isArray(INCIDENT_TRANSITIONS[s])).toBe(true);
    }
  });
});
