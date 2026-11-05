import { isRetentionMatured, retentionDueDate } from "@/lib/people/retention";

// P10e §B/§D.3 incident-record retention core (pure, unit-tested) — mirrors
// computeSubstanceDeletionCandidates. A record is a deletion candidate when its
// retention has matured from its trigger date AND it is not on legal hold.
// INCIDENT / FIRST_AID_RECORD run from the incident's closure date; INCIDENT_
// HEALTH runs from END_OF_EMPLOYMENT (the linked person's employmentEnd) and is
// suppressed while that person is on legalHold (§3.18 / §C.4 discipline).

export type IncidentRetentionRecordType =
  | "INCIDENT"
  | "FIRST_AID_RECORD"
  | "INCIDENT_HEALTH";

export type IncidentRecordCandidateInput = {
  recordType: IncidentRetentionRecordType;
  recordId: string;
  triggerDate: Date | null;
  retention: string | null;
  legalHold: boolean;
};

export function isIncidentRecordMatured(
  input: IncidentRecordCandidateInput,
  now: Date,
): boolean {
  if (input.legalHold) return false;
  return isRetentionMatured(input.triggerDate, input.retention, now);
}

export function computeIncidentDeletionCandidates(
  inputs: readonly IncidentRecordCandidateInput[],
  now: Date,
): {
  recordType: IncidentRetentionRecordType;
  recordId: string;
  maturedAt: Date;
}[] {
  const out: {
    recordType: IncidentRetentionRecordType;
    recordId: string;
    maturedAt: Date;
  }[] = [];
  for (const i of inputs) {
    if (!isIncidentRecordMatured(i, now)) continue;
    const due = retentionDueDate(i.triggerDate as Date, i.retention);
    if (due)
      out.push({
        recordType: i.recordType,
        recordId: i.recordId,
        maturedAt: due,
      });
  }
  return out;
}
