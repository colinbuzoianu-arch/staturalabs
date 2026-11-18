import type {
  RequirementSourceType,
  TrainingDeliveryMethod,
} from "@/generated/prisma/enums";
import {
  DEFAULT_DUE_SOON_DAYS,
  type InstructionCellStatus,
  instructionCellStatus,
} from "./instruction-status";

// P17 §4/§5 (SLD_P17_TENANT_ROLES_APPROVED.md): the employee's own-instruction
// view. Pure — the server-only caller (self-service.ts) resolves the required
// types + records from the DB and hands them here. Reuses the same four-state
// status and the same "strongest record per type wins" rule as the admin
// instruction matrix, so an employee and their leader always read the same
// status for the same requirement.

export type SelfRequiredType = {
  requirementTypeId: string;
  title: string;
  deliveryMethod: TrainingDeliveryMethod;
  recurrenceMonths: number | null;
  // Why this instruction applies (the §4 "erforderlich wegen …"): the kinds of
  // job subject (workstation / org unit / process / substance) that triggered it.
  sourceTypes: RequirementSourceType[];
};

export type SelfRecord = {
  requirementTypeId: string;
  validUntil: Date | null;
};

export type SelfInstruction = {
  requirementTypeId: string;
  title: string;
  status: InstructionCellStatus;
  validUntil: Date | null;
  sourceTypes: RequirementSourceType[];
  // Only a document-read-confirmation instruction can be confirmed by the
  // employee themselves (§5 "confirm a received instruction"). An in-person or
  // e-learning session is recorded by a leader/EHS, never self-confirmed — so
  // the confirm button is offered only for these, and only while not valid.
  selfConfirmable: boolean;
};

// Whether an employee may self-confirm this delivery method. Only the
// read-and-confirm kind; the other two are recorded by someone running the
// session. Pure + exported so the write gate and the UI agree on one rule.
export function isSelfConfirmableDelivery(
  method: TrainingDeliveryMethod,
): boolean {
  return method === "DOCUMENT_READ_CONFIRMATION";
}

// Pick the strongest record per requirement type: a null validUntil (no
// recurrence → valid indefinitely) beats any date; otherwise the later date
// wins. Mirrors buildInstructionMatrix's `best` selection exactly.
function strongestByType(
  records: readonly SelfRecord[],
): Map<string, SelfRecord> {
  const best = new Map<string, SelfRecord>();
  for (const r of records) {
    const existing = best.get(r.requirementTypeId);
    if (!existing) {
      best.set(r.requirementTypeId, r);
      continue;
    }
    if (existing.validUntil === null) continue;
    if (r.validUntil === null || r.validUntil > existing.validUntil) {
      best.set(r.requirementTypeId, r);
    }
  }
  return best;
}

export function buildSelfInstructions(
  required: readonly SelfRequiredType[],
  records: readonly SelfRecord[],
  now: Date,
  dueSoonDays: number = DEFAULT_DUE_SOON_DAYS,
): SelfInstruction[] {
  const best = strongestByType(records);
  return required.map((type) => {
    const rec = best.get(type.requirementTypeId);
    const status = instructionCellStatus(
      rec !== undefined,
      rec?.validUntil ?? null,
      now,
      dueSoonDays,
    );
    return {
      requirementTypeId: type.requirementTypeId,
      title: type.title,
      status,
      validUntil: rec?.validUntil ?? null,
      sourceTypes: type.sourceTypes,
      selfConfirmable:
        isSelfConfirmableDelivery(type.deliveryMethod) && status !== "valid",
    };
  });
}

// Count the instructions that need the employee's attention (anything not
// valid) — for the inbox summary badge.
export function countDueSelfInstructions(
  instructions: readonly SelfInstruction[],
): number {
  return instructions.filter((i) => i.status !== "valid").length;
}
