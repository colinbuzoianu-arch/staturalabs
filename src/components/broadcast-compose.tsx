"use client";

import { useState } from "react";

// The audience picker. A client component because the audience is a LIST the
// sender builds up (add/remove rows) and because the target dropdown depends
// on the chosen group type — the same "field visibility driven by a sibling
// select" shape ManualInputPanel and AddFindingFields already use.
//
// It only submits what the sender picked; the scope guard that decides whether
// they may address it lives on the server (src/lib/broadcasts/audience-scope.ts)
// and runs again at publish time.

export type AudienceOption = { id: string; name: string };
export type AudienceScopeValue =
  | "COMPANY"
  | "SITE"
  | "ORG_UNIT"
  | "WORKSTATION"
  | "ROLE";

export type ComposeDict = {
  audienceHeading: string;
  audienceHint: string;
  audienceScopeLabel: string;
  audienceTargetLabel: string;
  audienceAdd: string;
  audienceRemove: string;
  audienceEmpty: string;
  audienceScopeLabels: Record<AudienceScopeValue, string>;
  roleLabels: Record<string, string>;
  none: string;
};

type Row = {
  key: number;
  scope: AudienceScopeValue;
  target: string;
};

export function BroadcastAudiencePicker({
  dict,
  allowedScopes,
  sites,
  orgUnits,
  workstations,
  roles,
}: {
  dict: ComposeDict;
  allowedScopes: AudienceScopeValue[];
  sites: AudienceOption[];
  orgUnits: AudienceOption[];
  workstations: AudienceOption[];
  roles: string[];
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [nextKey, setNextKey] = useState(1);

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: nextKey, scope: allowedScopes[0], target: "" },
    ]);
    setNextKey((k) => k + 1);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function optionsFor(scope: AudienceScopeValue): AudienceOption[] {
    if (scope === "SITE") return sites;
    if (scope === "ORG_UNIT") return orgUnits;
    if (scope === "WORKSTATION") return workstations;
    if (scope === "ROLE")
      return roles.map((r) => ({ id: r, name: dict.roleLabels[r] ?? r }));
    return [];
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <legend className="px-1 font-heading text-sm font-bold">
        {dict.audienceHeading}
      </legend>
      <p className="text-xs text-foreground-muted">{dict.audienceHint}</p>

      {rows.length === 0 && (
        <p className="text-sm text-foreground-subtle">{dict.audienceEmpty}</p>
      )}

      {rows.map((row) => {
        const options = optionsFor(row.scope);
        const needsTarget = row.scope !== "COMPANY";
        return (
          <div key={row.key} className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              {dict.audienceScopeLabel}
              <select
                name="audienceScope"
                value={row.scope}
                onChange={(e) =>
                  updateRow(row.key, {
                    scope: e.target.value as AudienceScopeValue,
                    target: "",
                  })
                }
                className="rounded border border-border bg-background px-2 py-1"
              >
                {allowedScopes.map((s) => (
                  <option key={s} value={s}>
                    {dict.audienceScopeLabels[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {dict.audienceTargetLabel}
              {/* Always submitted, even for COMPANY (empty), so the server can
                  pair scope[i] with target[i] positionally. */}
              <select
                name="audienceTarget"
                value={row.target}
                disabled={!needsTarget}
                onChange={(e) => updateRow(row.key, { target: e.target.value })}
                className="rounded border border-border bg-background px-2 py-1 disabled:opacity-50"
              >
                <option value="">{needsTarget ? dict.none : "—"}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                setRows((prev) => prev.filter((r) => r.key !== row.key))
              }
              className="pb-1 text-xs text-coral hover:underline"
            >
              {dict.audienceRemove}
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRow}
        className="self-start rounded border border-border px-3 py-1 text-xs font-medium text-foreground"
      >
        {dict.audienceAdd}
      </button>
    </fieldset>
  );
}
