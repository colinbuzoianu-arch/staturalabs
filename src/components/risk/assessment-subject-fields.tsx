"use client";

import Link from "next/link";
import { useState } from "react";

// The "what is being assessed" part of the new-risk-assessment form: a
// workstation OR a process. Client component so only the relevant dropdown is
// shown (driven by the radio), instead of both selects always visible. If the
// site has no workstations / processes yet, a hint + link is shown instead of
// an empty dropdown.
type Option = { id: string; name: string };

export function AssessmentSubjectFields({
  siteId,
  workstations,
  processes,
  labels,
}: {
  siteId: string;
  workstations: readonly Option[];
  processes: readonly Option[];
  labels: {
    subjectTypeLabel: string;
    workstationOption: string;
    processOption: string;
    workstationLabel: string;
    processLabel: string;
    noWorkstationsHint: string;
    noProcessesHint: string;
  };
}) {
  const [subjectType, setSubjectType] = useState<"workstation" | "process">(
    "workstation",
  );

  const selectClass =
    "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground-muted">
          {labels.subjectTypeLabel}
        </span>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="subjectType"
              value="workstation"
              checked={subjectType === "workstation"}
              onChange={() => setSubjectType("workstation")}
            />
            {labels.workstationOption}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="subjectType"
              value="process"
              checked={subjectType === "process"}
              onChange={() => setSubjectType("process")}
            />
            {labels.processOption}
          </label>
        </div>
      </fieldset>

      {subjectType === "workstation" ? (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-foreground-muted">
            {labels.workstationLabel}
          </span>
          {workstations.length === 0 ? (
            <span className="text-xs text-foreground-subtle">
              {labels.noWorkstationsHint}{" "}
              <Link
                href={`/app/s/${siteId}/risk/workstations`}
                className="text-accent hover:underline"
              >
                →
              </Link>
            </span>
          ) : (
            <select name="workstationId" className={selectClass}>
              {workstations.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-foreground-muted">
            {labels.processLabel}
          </span>
          {processes.length === 0 ? (
            <span className="text-xs text-foreground-subtle">
              {labels.noProcessesHint}{" "}
              <Link
                href={`/app/s/${siteId}/risk/processes`}
                className="text-accent hover:underline"
              >
                →
              </Link>
            </span>
          ) : (
            <select name="processId" className={selectClass}>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
