import { ManualInputType } from "@/generated/prisma/enums";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import type { Locale } from "@/lib/i18n/locale";

// Deliberately no `import "server-only"` here — this module is shared by
// the capture page (client, for form field visibility + a pre-submit
// shape check) and the API route (server, as the authoritative check
// before the DB's own ManualInput_value_shape_check CHECK constraint would
// reject a malformed insert). Pure data + pure functions only.

export const MANUAL_INPUT_TYPES = Object.values(ManualInputType);

export const MANUAL_INPUT_LABELS: Record<ManualInputType, string> = {
  LOAD_WEIGHT_KG: "Load weight",
  PUSH_FORCE_N: "Push force",
  PULL_FORCE_N: "Pull force",
  TOOL_USED: "Tool used",
  REPETITION_COUNT: "Repetition count",
  DURATION_SECONDS: "Duration",
};

// TOOL_USED is the only type without a numeric value, so it's also the
// only one without a unit — see isTextManualInputType. These are the
// units written to the free-text `unit` column; the schema doesn't
// constrain that column to these strings, but the enum name bakes the
// intended unit in, so the UI locks it rather than offering a free-text
// or multi-option unit field (no unit-conversion logic exists anywhere).
export const MANUAL_INPUT_UNITS: Partial<Record<ManualInputType, string>> = {
  LOAD_WEIGHT_KG: "kg",
  PUSH_FORCE_N: "N",
  PULL_FORCE_N: "N",
  REPETITION_COUNT: "reps",
  DURATION_SECONDS: "s",
};

export function isTextManualInputType(inputType: ManualInputType): boolean {
  return inputType === ManualInputType.TOOL_USED;
}

export type ManualInputShapeInput = {
  inputType: ManualInputType;
  value: number | null;
  unit: string | null;
  textValue: string | null;
};

// Mirrors the DB's ManualInput_value_shape_check CHECK constraint exactly
// (prisma/migrations/20260708114616_restructure_assessment_chain_and_rls/
// migration.sql) — the same shape rule enforced in two places on purpose:
// here, so the UI/API can reject a bad shape with a clear message instead
// of a raw constraint-violation error; the DB constraint stays as the
// backstop of record regardless of what this function does.
export function validateManualInputShape(
  input: ManualInputShapeInput,
): string | null {
  if (isTextManualInputType(input.inputType)) {
    if (!input.textValue) {
      return `textValue is required for ${input.inputType}`;
    }
    if (input.value !== null || input.unit !== null) {
      return `value and unit must be empty for ${input.inputType}`;
    }
    return null;
  }

  if (input.value === null || input.unit === null) {
    return `value and unit are required for ${input.inputType}`;
  }
  if (input.textValue !== null) {
    return `textValue must be empty for ${input.inputType}`;
  }
  return null;
}

// Shared one-line rendering of a ManualInput row — used by the capture
// page's "just added" list, the task page's read view, and the task PDF
// report, so none of them drift into describing the same row differently
// (same reasoning as describe-region-result.ts for RegionResult).
//
// `entry.unit` is always one of the canonical strings MANUAL_INPUT_UNITS
// locks at write time (kg/N/reps/s — see validateManualInputShape) — this
// only translates the display of that fixed vocabulary (B8c,
// SLD_NEXT_STEPS_B8b-B8f.md: "reps" reads as an English abbreviation next
// to a German number), never the persisted value itself. Defaults to
// English so every pre-existing call site (none of which passed a second
// argument before this) keeps behaving exactly as before.
export function describeManualInput(
  entry: ManualInputShapeInput,
  locale: Locale = "en",
): string {
  if (isTextManualInputType(entry.inputType)) {
    return entry.textValue ?? "";
  }
  const unitLabels = getCommonDictionary(locale).manualInputUnitLabels;
  const unit =
    entry.unit && entry.unit in unitLabels
      ? unitLabels[entry.unit as keyof typeof unitLabels]
      : entry.unit;
  return `${entry.value} ${unit}`;
}
