// P7d §A.3 (SLD_P7B_DEFERRALS_RESOLVED.md): instruction-matrix core. The
// matrix shows REQUIRED cells only (a type is required for a person via
// requirement derivation); non-required cells render "—". Four statuses:
// valid · due-soon (≤ dueSoonDays) · overdue · missing. Pure, unit-tested.
// Operational per-person view (an explicit §7.6 duty, not a statistic — no
// §3.4 minimum-group-size gate; that applies to the P12 coverage KPIs).

export const DEFAULT_DUE_SOON_DAYS = 30;

export type InstructionCellStatus =
  | "valid"
  | "due-soon"
  | "overdue"
  | "missing";

// Status of one required (person, type) cell from the person's latest record.
// No record → missing. null validUntil (no recurrence) → valid indefinitely.
// Past → overdue. Within dueSoonDays → due-soon. Else valid.
export function instructionCellStatus(
  hasRecord: boolean,
  latestValidUntil: Date | null,
  now: Date,
  dueSoonDays: number = DEFAULT_DUE_SOON_DAYS,
): InstructionCellStatus {
  if (!hasRecord) return "missing";
  if (latestValidUntil === null) return "valid";
  if (latestValidUntil < now) return "overdue";
  const soon = new Date(now.getTime() + dueSoonDays * 24 * 60 * 60 * 1000);
  return latestValidUntil <= soon ? "due-soon" : "valid";
}

export type MatrixPerson = { id: string };
export type MatrixType = { id: string };
export type MatrixRecord = {
  personId: string;
  requirementTypeId: string;
  validUntil: Date | null;
};

export type MatrixCell = {
  personId: string;
  requirementTypeId: string;
  required: boolean;
  // Only meaningful (and set) when required.
  status: InstructionCellStatus | null;
  validUntil: Date | null;
};

// Build persons × types, flagging each cell required or not (via requiredKeys,
// a set of "personId:requirementTypeId"); status is computed only for required
// cells. The strongest record per (person, type) wins (null validUntil beats
// any date; else later). dueCount = required cells that are not valid.
export function buildInstructionMatrix(
  persons: readonly MatrixPerson[],
  types: readonly MatrixType[],
  records: readonly MatrixRecord[],
  requiredKeys: ReadonlySet<string>,
  now: Date,
  dueSoonDays: number = DEFAULT_DUE_SOON_DAYS,
): { cells: MatrixCell[]; dueCount: number } {
  const best = new Map<string, MatrixRecord>();
  for (const r of records) {
    const key = `${r.personId}:${r.requirementTypeId}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, r);
      continue;
    }
    if (existing.validUntil === null) continue;
    if (r.validUntil === null || r.validUntil > existing.validUntil) {
      best.set(key, r);
    }
  }

  const cells: MatrixCell[] = [];
  let dueCount = 0;
  for (const person of persons) {
    for (const type of types) {
      const key = `${person.id}:${type.id}`;
      const required = requiredKeys.has(key);
      if (!required) {
        cells.push({
          personId: person.id,
          requirementTypeId: type.id,
          required: false,
          status: null,
          validUntil: null,
        });
        continue;
      }
      const rec = best.get(key);
      const status = instructionCellStatus(
        rec !== undefined,
        rec?.validUntil ?? null,
        now,
        dueSoonDays,
      );
      if (status !== "valid") dueCount++;
      cells.push({
        personId: person.id,
        requirementTypeId: type.id,
        required: true,
        status,
        validUntil: rec?.validUntil ?? null,
      });
    }
  }
  return { cells, dueCount };
}
