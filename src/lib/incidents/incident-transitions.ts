import type { IncidentStatus } from "@/generated/prisma/enums";

// P10a (SLD_P10_COMPARTMENT_DESIGN_NOTE.md §3) incident status machine — pure,
// unit-tested, the same shape as the inspection/action transition tables.
//
// REPORTED -> TRIAGED -> UNDER_INVESTIGATION -> ACTIONS_PENDING -> CLOSED,
// with one revert (CLOSED -> ACTIONS_PENDING to reopen a closed case). Triage
// may also short-circuit straight to ACTIONS_PENDING (a clear-cut event that
// needs a corrective action but no formal investigation) or to CLOSED (a
// logged near-miss/first-aid entry that needs nothing further). No skipping
// backwards except the single CLOSED -> ACTIONS_PENDING reopen.

export const INCIDENT_TRANSITIONS: Readonly<
  Record<IncidentStatus, readonly IncidentStatus[]>
> = {
  REPORTED: ["TRIAGED"],
  TRIAGED: ["UNDER_INVESTIGATION", "ACTIONS_PENDING", "CLOSED"],
  UNDER_INVESTIGATION: ["ACTIONS_PENDING", "CLOSED"],
  ACTIONS_PENDING: ["CLOSED"],
  CLOSED: ["ACTIONS_PENDING"],
};

export function canTransitionIncident(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return INCIDENT_TRANSITIONS[from].includes(to);
}
