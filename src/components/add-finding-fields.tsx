"use client";

import { useState } from "react";
import type {
  HazardCategory,
  PsychosocialDimension,
  PsychosocialMethod,
} from "@/generated/prisma/enums";

export type FindingHazardOption = {
  id: string;
  category: HazardCategory;
  label: string;
};

// SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B7: "structured findings,
// not a survey platform." The hazard select and the psychosocial-only
// fields it conditionally reveals live in one client component (same
// "field visibility driven by a sibling select" shape as ManualInputPanel
// — see CLAUDE.md) rather than a separate form, since the psychosocial
// fields need to react to which hazard was picked in the SAME select.
// The floor of 15 for QUESTIONNAIRE is enforced server-side
// (validatePsychosocialGroupSize) and at the DB level (the hand-added
// PsychosocialFindingDetail_group_size_check CHECK) — the hint text here
// is guidance, not the actual guarantee.
export function AddFindingFields({
  hazards,
  labels,
}: {
  hazards: readonly FindingHazardOption[];
  labels: {
    hazardLabel: string;
    dimensionLabel: string;
    dimensionOptions: Record<PsychosocialDimension, string>;
    methodLabel: string;
    methodOptions: Record<PsychosocialMethod, string>;
    groupSizeLabel: string;
    groupSizeQuestionnaireHint: string;
    externalProcedureNameLabel: string;
  };
}) {
  const [hazardId, setHazardId] = useState(hazards[0]?.id ?? "");
  const [method, setMethod] = useState<PsychosocialMethod>("GROUP_DISCUSSION");
  const isPsychosocial =
    hazards.find((h) => h.id === hazardId)?.category === "PSYCHOSOCIAL";

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        {labels.hazardLabel}
        <select
          name="hazardId"
          value={hazardId}
          onChange={(e) => setHazardId(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1"
        >
          {hazards.map((hazard) => (
            <option key={hazard.id} value={hazard.id}>
              {hazard.label}
            </option>
          ))}
        </select>
      </label>

      {isPsychosocial && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            {labels.dimensionLabel}
            <select
              name="dimension"
              required
              className="rounded border border-border bg-background px-2 py-1"
            >
              {(
                Object.entries(labels.dimensionOptions) as Array<
                  [PsychosocialDimension, string]
                >
              ).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {labels.methodLabel}
            <select
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PsychosocialMethod)}
              className="rounded border border-border bg-background px-2 py-1"
            >
              {(
                Object.entries(labels.methodOptions) as Array<
                  [PsychosocialMethod, string]
                >
              ).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {labels.groupSizeLabel}
            <input
              type="number"
              name="groupSize"
              min={1}
              required
              className="w-20 rounded border border-border bg-background px-2 py-1"
            />
            {method === "QUESTIONNAIRE" && (
              <span className="max-w-[16rem] text-xs text-border">
                {labels.groupSizeQuestionnaireHint}
              </span>
            )}
          </label>
          {method === "QUESTIONNAIRE" && (
            <label className="flex flex-col gap-1 text-sm">
              {labels.externalProcedureNameLabel}
              <input
                name="externalProcedureName"
                className="w-40 rounded border border-border bg-background px-2 py-1"
              />
            </label>
          )}
        </>
      )}
    </>
  );
}
