"use client";

import { useState } from "react";

export type ExposureLimitOption = {
  id: string;
  parameterKey: string;
  parameterLabel: string;
  unit: string;
  actionValue: number | null;
  limitValue: number | null;
  legalReference: string;
};

// Prefills unit/actionValue/limitValue/*Reference from a catalog row
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.4/§4.5 — "nobody types 85
// by hand again"), while keeping every field genuinely editable: this is
// a UX default, not an enforced equality with the catalog. `key={...}` on
// each input forces a remount (a fresh `defaultValue`, uncontrolled
// afterward) whenever the selected parameter changes, so picking a
// different parameter — or switching back to manual entry — replaces the
// prefill without fighting whatever the user has since typed.
//
// `exposureLimitId` (hidden) records which catalog row supplied the
// prefill, regardless of whether the visible fields were edited
// afterward — provenance, not a promise of exact equality (see
// ExposureMeasurement's schema comment). Empty when `options` is empty
// (no catalog row for this site's country/hazard category yet) or when
// the operator picks "manual entry" — the pre-existing free-text
// behavior, unchanged, and the only path at all for a country with no
// seeded catalog (e.g. CH today — see ERGO_COMPLIANCE_BY_DESIGN.md
// §3.15: never fall back to another country's numbers here).
export function ExposureLimitFields({
  options,
  labels,
}: {
  options: readonly ExposureLimitOption[];
  labels: {
    parameterLabel: string;
    parameterManualOption: string;
    noExposureLimitForCountry: string | null;
    unitLabel: string;
    actionValueLabel: string;
    actionValueReferenceLabel: string;
    limitValueLabel: string;
    limitReferenceLabel: string;
  };
}) {
  const [selectedId, setSelectedId] = useState("");
  const selected = options.find((o) => o.id === selectedId) ?? null;

  return (
    <>
      <input type="hidden" name="exposureLimitId" value={selectedId} />

      {options.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm">
          {labels.parameterLabel}
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="">{labels.parameterManualOption}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.parameterLabel}
              </option>
            ))}
          </select>
        </label>
      ) : (
        labels.noExposureLimitForCountry && (
          <p className="max-w-xs text-xs text-border">
            {labels.noExposureLimitForCountry}
          </p>
        )
      )}

      <label className="flex flex-col gap-1 text-sm">
        {labels.unitLabel}
        <input
          key={`unit-${selectedId}`}
          name="unit"
          required
          defaultValue={selected?.unit ?? ""}
          className="w-24 rounded border border-border bg-background px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.actionValueLabel}
        <input
          key={`action-value-${selectedId}`}
          type="number"
          step="any"
          name="actionValue"
          defaultValue={selected?.actionValue ?? ""}
          className="w-24 rounded border border-border bg-background px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.actionValueReferenceLabel}
        <input
          key={`action-ref-${selectedId}`}
          name="actionValueReference"
          defaultValue={selected?.legalReference ?? ""}
          className="w-40 rounded border border-border bg-background px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.limitValueLabel}
        <input
          key={`limit-value-${selectedId}`}
          type="number"
          step="any"
          name="limitValue"
          defaultValue={selected?.limitValue ?? ""}
          className="w-24 rounded border border-border bg-background px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.limitReferenceLabel}
        <input
          key={`limit-ref-${selectedId}`}
          name="limitReference"
          defaultValue={selected?.legalReference ?? ""}
          className="w-40 rounded border border-border bg-background px-2 py-1"
        />
      </label>
    </>
  );
}
