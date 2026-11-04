// P7c-2 instruction matrix core (plan §7.6). Pure — no DB, no `server-only` —
// unit-tested. The matrix is an OPERATIONAL per-person view (who still needs
// instruction), an explicit §7.6 duty — not a person-derived statistic, so
// the §3.4 minimum-group-size rule does not apply here (it applies to the
// coverage KPIs in P12).

export type InstructionCellStatus = "valid" | "expired" | "missing";

// Status of one (person, requirement type) cell given the person's latest
// record for that type (if any). No record → missing. A record with no
// validUntil (requirement has no recurrence) → valid indefinitely. Otherwise
// valid while validUntil is in the future, else expired.
export function instructionCellStatus(
  hasRecord: boolean,
  latestValidUntil: Date | null,
  now: Date,
): InstructionCellStatus {
  if (!hasRecord) return "missing";
  if (latestValidUntil === null) return "valid";
  return latestValidUntil >= now ? "valid" : "expired";
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
  status: InstructionCellStatus;
  validUntil: Date | null;
};

// Build the full persons × types matrix. For each cell, the person's LATEST
// record for that type wins (by latest validUntil; a null validUntil — no
// recurrence — counts as the strongest "valid").
export function buildInstructionMatrix(
  persons: readonly MatrixPerson[],
  types: readonly MatrixType[],
  records: readonly MatrixRecord[],
  now: Date,
): { cells: MatrixCell[]; dueCount: number } {
  // Best record per (personId, requirementTypeId).
  const best = new Map<string, MatrixRecord>();
  for (const r of records) {
    const key = `${r.personId}:${r.requirementTypeId}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, r);
      continue;
    }
    // A null validUntil (indefinite) beats any date; otherwise later wins.
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
      const rec = best.get(key);
      const status = instructionCellStatus(
        rec !== undefined,
        rec?.validUntil ?? null,
        now,
      );
      if (status !== "valid") dueCount++;
      cells.push({
        personId: person.id,
        requirementTypeId: type.id,
        status,
        validUntil: rec?.validUntil ?? null,
      });
    }
  }
  return { cells, dueCount };
}
