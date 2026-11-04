import { retentionDueDate } from "@/lib/people/retention";

// P8 §3.4 substance-record retention core (pure). SDS and SubstanceUse rows
// become deletion candidates once their retention (from the LAST_USE trigger)
// has matured. No DB; unit-tested. The retention duration is resolved by the
// caller (company setting, never shorter than the REACH Art. 36 statutory floor
// for SDS) — same pure/impure split as the person retention core.

export type SubstanceRecordType = "SDS" | "SUBSTANCE_USE";

export type SubstanceRecordCandidateInput = {
  recordType: SubstanceRecordType;
  recordId: string;
  // When the record was last used (SDS.lastUsedAt / SubstanceUse.activeTo).
  // null = still in use / never marked → never matures.
  lastUsedAt: Date | null;
  // Already-resolved ISO-8601 retention (e.g. "P10Y"), null = no period.
  retention: string | null;
};

export function substanceRecordDueDate(
  input: SubstanceRecordCandidateInput,
): Date | null {
  if (!input.lastUsedAt) return null;
  return retentionDueDate(input.lastUsedAt, input.retention);
}

export function isSubstanceRecordMatured(
  input: SubstanceRecordCandidateInput,
  now: Date,
): boolean {
  const due = substanceRecordDueDate(input);
  return due !== null && due <= now;
}

export function computeSubstanceDeletionCandidates(
  records: readonly SubstanceRecordCandidateInput[],
  now: Date,
): { recordType: SubstanceRecordType; recordId: string; maturedAt: Date }[] {
  const out: {
    recordType: SubstanceRecordType;
    recordId: string;
    maturedAt: Date;
  }[] = [];
  for (const r of records) {
    if (!isSubstanceRecordMatured(r, now)) continue;
    const due = substanceRecordDueDate(r);
    if (due)
      out.push({
        recordType: r.recordType,
        recordId: r.recordId,
        maturedAt: due,
      });
  }
  return out;
}
