"use client";

import type { BodyRegion } from "@/generated/prisma/enums";
import type { RegionResult } from "@/lib/capture/types";
import { useSimulatorCoordinator } from "./simulator-coordinator";
import { WhatIfSimulator } from "./what-if-simulator";

// A "Simulate" affordance below a PostureSample's per-region results table —
// the secondary, collapsible exploration tool; the table above it stays the
// primary view. Renders nothing for a sample with no "scored" region at
// all: there's no measured angle for the simulator to start a slider from,
// same reasoning as WhatIfSimulator's own non-scored StatusRow, just one
// level up (skip the affordance entirely rather than show a button that
// opens onto an empty panel).
export function PostureSampleSimulatorToggle({
  sampleId,
  regionResults,
}: {
  sampleId: string;
  regionResults: Record<BodyRegion, RegionResult>;
}) {
  const { openSampleId, toggle } = useSimulatorCoordinator();
  const isOpen = openSampleId === sampleId;

  const hasScoredRegion = Object.values(regionResults).some(
    (result) => result.status === "scored",
  );
  if (!hasScoredRegion) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => toggle(sampleId)}
        aria-expanded={isOpen}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {isOpen ? "Hide simulator" : "Simulate"}
      </button>

      {isOpen && (
        <div className="mt-3">
          <WhatIfSimulator regionResults={regionResults} />
        </div>
      )}
    </div>
  );
}
