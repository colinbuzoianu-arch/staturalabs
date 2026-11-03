"use client";

import { useState } from "react";
import type {
  HazardCategory,
  HierarchyOfControl,
} from "@/generated/prisma/enums";
import { shouldShowStopHint } from "@/lib/risk/typical-measure";

// P6 §6 raise-action form with the typical-measure picker
// (SLD_P6_TYPICAL_MEASURES_APPROVED.md §4.3). Client component because the
// suggestion picker reacts to the selected finding: picking a measure
// pre-fills the title + control type and records its provenance
// (typicalMeasureId) via a hidden input. The server action is unchanged and
// receives the same field names — selecting a suggestion only writes into the
// ordinary title/hierarchy fields, which the assessor can still edit. Nothing
// is auto-created; the STOP hint is non-blocking.

export type MeasureOption = {
  id: string;
  hierarchyOfControl: HierarchyOfControl;
  measureDe: string;
  measureEn: string | null;
  // Within-category order; used server-side to sort, carried along harmlessly.
  order: number;
};

type FindingOption = {
  id: string;
  label: string;
  category: HazardCategory;
  hasHigherTierAction: boolean;
};

type SessionOption = { id: string; label: string };
type EnvFindingOption = { id: string; label: string };
type UserOption = { id: string; label: string };
type HierarchyOption = { value: HierarchyOfControl; label: string };

export type RaiseActionLabels = {
  fromFindingOption: string;
  fromSessionOption: string;
  fromEnvironmentalFindingOption: string;
  findingLabel: string;
  sessionLabel: string;
  environmentalFindingLabel: string;
  titleLabel: string;
  descriptionLabel: string;
  hierarchyLabel: string;
  responsibleUserLabel: string;
  responsibleRoleLabel: string;
  dueDateLabel: string;
  create: string;
  none: string;
  measuresHeading: string;
  measuresHint: string;
  measuresNone: string;
  clearSuggestion: string;
  stopHint: string;
};

export function RaiseActionForm({
  action,
  locale,
  findings,
  sessions,
  environmentalFindings,
  users,
  hierarchyOptions,
  measuresByCategory,
  hierarchyLabels,
  defaultFindingId,
  defaultEnvironmentalFindingId,
  labels,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  findings: FindingOption[];
  sessions: SessionOption[];
  environmentalFindings: EnvFindingOption[];
  users: UserOption[];
  hierarchyOptions: HierarchyOption[];
  measuresByCategory: Partial<Record<HazardCategory, MeasureOption[]>>;
  hierarchyLabels: Record<HierarchyOfControl, string>;
  defaultFindingId: string | null;
  defaultEnvironmentalFindingId: string | null;
  labels: RaiseActionLabels;
}) {
  const [sourceType, setSourceType] = useState<
    "finding" | "session" | "environmental-finding"
  >(
    defaultFindingId
      ? "finding"
      : defaultEnvironmentalFindingId
        ? "environmental-finding"
        : "session",
  );
  const [findingId, setFindingId] = useState(defaultFindingId ?? "");
  const [title, setTitle] = useState("");
  const [hierarchy, setHierarchy] = useState<HierarchyOfControl | "">("");
  const [typicalMeasureId, setTypicalMeasureId] = useState("");

  const measureText = (m: MeasureOption) =>
    locale === "de" ? m.measureDe : (m.measureEn ?? m.measureDe);

  const selectedFinding = findings.find((f) => f.id === findingId) ?? null;
  const categoryMeasures =
    selectedFinding != null
      ? (measuresByCategory[selectedFinding.category] ?? [])
      : [];

  const selectedMeasure = categoryMeasures.find(
    (m) => m.id === typicalMeasureId,
  );
  const showStop =
    sourceType === "finding" &&
    selectedMeasure != null &&
    selectedFinding != null &&
    shouldShowStopHint(
      selectedMeasure.hierarchyOfControl,
      selectedFinding.hasHigherTierAction,
    );

  function pick(m: MeasureOption) {
    setTitle(measureText(m));
    setHierarchy(m.hierarchyOfControl);
    setTypicalMeasureId(m.id);
  }
  function clearPick() {
    setTypicalMeasureId("");
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap gap-4 text-sm">
        {(
          [
            ["finding", labels.fromFindingOption],
            ["session", labels.fromSessionOption],
            ["environmental-finding", labels.fromEnvironmentalFindingOption],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-1">
            <input
              type="radio"
              name="sourceType"
              value={value}
              checked={sourceType === value}
              onChange={() => setSourceType(value)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {labels.findingLabel}
          <select
            name="riskFindingId"
            value={findingId}
            onChange={(e) => {
              setFindingId(e.target.value);
              setTypicalMeasureId("");
            }}
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="">{labels.none}</option>
            {findings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {labels.sessionLabel}
          <select
            name="assessmentSessionId"
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="">{labels.none}</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {labels.environmentalFindingLabel}
          <select
            name="environmentalFindingId"
            defaultValue={defaultEnvironmentalFindingId ?? ""}
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="">{labels.none}</option>
            {environmentalFindings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sourceType === "finding" && selectedFinding != null && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-background p-3 text-sm">
          <p className="font-semibold">{labels.measuresHeading}</p>
          <p className="text-xs text-foreground-subtle">
            {labels.measuresHint}
          </p>
          {categoryMeasures.length === 0 ? (
            <p className="text-xs text-foreground-subtle">
              {labels.measuresNone}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {categoryMeasures.map((m) => {
                const selected = m.id === typicalMeasureId;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => (selected ? clearPick() : pick(m))}
                      className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left ${
                        selected
                          ? "bg-accent/15 ring-1 ring-accent"
                          : "hover:bg-surface-raised"
                      }`}
                    >
                      <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-foreground-muted">
                        {hierarchyLabels[m.hierarchyOfControl]}
                      </span>
                      <span>{measureText(m)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {typicalMeasureId !== "" && (
            <button
              type="button"
              onClick={clearPick}
              className="self-start text-xs text-foreground-subtle underline hover:text-accent"
            >
              {labels.clearSuggestion}
            </button>
          )}
          {showStop && (
            <p className="rounded bg-amber-500/10 px-2 py-1 text-xs text-foreground-muted">
              {labels.stopHint}
            </p>
          )}
        </div>
      )}

      <input type="hidden" name="typicalMeasureId" value={typicalMeasureId} />

      <label className="flex flex-col gap-1 text-sm">
        {labels.titleLabel}
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded border border-border bg-background px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.descriptionLabel}
        <input
          name="description"
          className="rounded border border-border bg-background px-2 py-1"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {labels.hierarchyLabel}
          <select
            name="hierarchyOfControl"
            value={hierarchy}
            onChange={(e) =>
              setHierarchy(e.target.value as HierarchyOfControl | "")
            }
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="">{labels.none}</option>
            {hierarchyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {labels.responsibleUserLabel}
          <select
            name="responsibleUserId"
            className="rounded border border-border bg-background px-2 py-1"
          >
            <option value="">{labels.none}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {labels.responsibleRoleLabel}
          <input
            name="responsibleRoleLabel"
            className="rounded border border-border bg-background px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {labels.dueDateLabel}
          <input
            type="date"
            name="dueDate"
            className="rounded border border-border bg-background px-2 py-1"
          />
        </label>
      </div>
      <button
        type="submit"
        className="self-start rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
      >
        {labels.create}
      </button>
    </form>
  );
}
