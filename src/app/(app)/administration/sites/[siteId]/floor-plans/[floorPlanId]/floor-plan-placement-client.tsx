"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, useState } from "react";
import {
  placeTask,
  placeWorkstation,
  removeTaskPosition,
  removeWorkstationPosition,
} from "./actions";

type TaskInfo = { id: string; name: string };
type WorkstationInfo = { id: string; name: string; tasks: TaskInfo[] };
type Position = { x: number; y: number };

type ArmedTarget =
  | { kind: "workstation"; id: string; name: string }
  | { kind: "task"; id: string; name: string };

type PlacementMode = "workstation" | "task";

export type FloorPlanPlacementDict = {
  modeWorkstations: string;
  modeTasks: string;
  summaryWorkstationsPlaced: string;
  summaryTasksPlaced: string;
  workstationsHeading: string;
  placedLabel: string;
  placeOnMap: string;
  remove: string;
  placingInstructionPrefix: string;
  cancelPlacing: string;
  noTasks: string;
  tasksPlacedSuffix: string;
  errorSaving: string;
  imageAltPrefix: string;
};

// No drag-to-reposition: it would need its own pointer-event state machine
// (distinguishing a drag from the click-to-place arm/fire interaction
// below, tracking the dragged marker's identity across mousemove, handling
// the boundary-clamping this component already does for a fresh
// placement) layered on top of two already-distinct entity types
// (workstation vs. task). Remove + re-place is one extra click and covers
// the same outcome without that complexity, so drag is left out here.
//
// Marker sizes are fixed pixel values, not viewBox-relative — see the
// overlay's own comment below for why the SVG has no viewBox at all.
const WORKSTATION_MARKER_RADIUS = 8;
const WORKSTATION_MARKER_RADIUS_DIMMED = 5;
const TASK_MARKER_SIZE = 10;

export function FloorPlanPlacementClient({
  floorPlanId,
  floorPlanName,
  imageUrl,
  imageWidth,
  imageHeight,
  workstations,
  initialWorkstationPositions,
  initialTaskPositions,
  dict,
}: {
  floorPlanId: string;
  floorPlanName: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  workstations: WorkstationInfo[];
  initialWorkstationPositions: Array<{
    workstationId: string;
    x: number;
    y: number;
  }>;
  initialTaskPositions: Array<{ taskId: string; x: number; y: number }>;
  dict: FloorPlanPlacementDict;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PlacementMode>("workstation");
  const [workstationPositions, setWorkstationPositions] = useState<
    Record<string, Position>
  >(() =>
    Object.fromEntries(
      initialWorkstationPositions.map((p) => [
        p.workstationId,
        { x: p.x, y: p.y },
      ]),
    ),
  );
  const [taskPositions, setTaskPositions] = useState<Record<string, Position>>(
    () =>
      Object.fromEntries(
        initialTaskPositions.map((p) => [p.taskId, { x: p.x, y: p.y }]),
      ),
  );
  const [armedTarget, setArmedTarget] = useState<ArmedTarget | null>(null);
  const [expandedWorkstationIds, setExpandedWorkstationIds] = useState<
    Set<string>
  >(new Set());
  const [selectedTaskLabelId, setSelectedTaskLabelId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const totalTasks = workstations.reduce((sum, w) => sum + w.tasks.length, 0);
  const placedWorkstationCount = Object.keys(workstationPositions).length;
  const placedTaskCount = Object.keys(taskPositions).length;

  function switchMode(next: PlacementMode) {
    setMode(next);
    setArmedTarget(null);
    setError(null);
  }

  function toggleExpanded(workstationId: string) {
    setExpandedWorkstationIds((prev) => {
      const next = new Set(prev);
      if (next.has(workstationId)) {
        next.delete(workstationId);
      } else {
        next.add(workstationId);
      }
      return next;
    });
  }

  async function handlePlanClick(event: MouseEvent<HTMLDivElement>) {
    if (!armedTarget) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    const y = Math.min(
      1,
      Math.max(0, (event.clientY - rect.top) / rect.height),
    );

    const target = armedTarget;
    setArmedTarget(null);
    setError(null);

    if (target.kind === "workstation") {
      setWorkstationPositions((prev) => ({ ...prev, [target.id]: { x, y } }));
      try {
        await placeWorkstation(floorPlanId, target.id, x, y);
        router.refresh();
      } catch {
        setError(dict.errorSaving);
        setWorkstationPositions((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      }
    } else {
      setTaskPositions((prev) => ({ ...prev, [target.id]: { x, y } }));
      try {
        await placeTask(floorPlanId, target.id, x, y);
        router.refresh();
      } catch {
        setError(dict.errorSaving);
        setTaskPositions((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
      }
    }
  }

  async function handleRemoveWorkstation(workstationId: string) {
    setError(null);
    const previous = workstationPositions[workstationId];
    setWorkstationPositions((prev) => {
      const next = { ...prev };
      delete next[workstationId];
      return next;
    });
    try {
      await removeWorkstationPosition(floorPlanId, workstationId);
      router.refresh();
    } catch {
      setError(dict.errorSaving);
      if (previous) {
        setWorkstationPositions((prev) => ({
          ...prev,
          [workstationId]: previous,
        }));
      }
    }
  }

  async function handleRemoveTask(taskId: string) {
    setError(null);
    const previous = taskPositions[taskId];
    setTaskPositions((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    try {
      await removeTaskPosition(floorPlanId, taskId);
      router.refresh();
    } catch {
      setError(dict.errorSaving);
      if (previous) {
        setTaskPositions((prev) => ({ ...prev, [taskId]: previous }));
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Placement mode"
          className="flex gap-1 rounded-lg border border-border bg-surface p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "workstation"}
            onClick={() => switchMode("workstation")}
            className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === "workstation"
                ? "bg-accent text-background"
                : "hover:bg-background"
            }`}
          >
            {dict.modeWorkstations}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "task"}
            onClick={() => switchMode("task")}
            className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
              mode === "task"
                ? "bg-accent text-background"
                : "hover:bg-background"
            }`}
          >
            {dict.modeTasks}
          </button>
        </div>

        <p className="text-sm text-border">
          {placedWorkstationCount}/{workstations.length}{" "}
          {dict.summaryWorkstationsPlaced}, {placedTaskCount}/{totalTasks}{" "}
          {dict.summaryTasksPlaced}
        </p>
      </div>

      {armedTarget && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-surface px-4 py-2 text-sm">
          <span>
            {dict.placingInstructionPrefix} &ldquo;{armedTarget.name}&rdquo;
          </span>
          <button
            type="button"
            onClick={() => setArmedTarget(null)}
            className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
          >
            {dict.cancelPlacing}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: this is a spatial click-to-place surface — the "action" is an arbitrary x/y coordinate, which has no meaningful keyboard equivalent within this feature's scope. Placement is also always reachable via the sidebar's "Place on map" + click flow, never keyboard-only. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: same reasoning — no keyboard equivalent for picking an arbitrary point on the image. */}
        <div
          className="relative w-full max-w-4xl overflow-hidden rounded-lg border border-border select-none"
          style={{
            aspectRatio: `${imageWidth} / ${imageHeight}`,
            cursor: armedTarget ? "crosshair" : "default",
          }}
          onClick={handlePlanClick}
        >
          {/* biome-ignore lint/performance/noImgElement: signed URL is per-request/short-lived, not a static asset for Next's image optimizer to cache */}
          <img
            src={imageUrl}
            alt={`${dict.imageAltPrefix} ${floorPlanName}`}
            className="pointer-events-none block h-full w-full object-fill"
            draggable={false}
          />

          {/* No viewBox: cx/cy/x/y below are percentage strings, which SVG
              resolves independently against the element's own rendered
              width/height. That keeps circles circular and text
              undistorted regardless of the image's aspect ratio — a
              viewBox with preserveAspectRatio="none" would need to
              stretch non-uniformly and warp both. */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {workstations.map((workstation) => {
              const position = workstationPositions[workstation.id];
              if (!position) return null;
              const dimmed = mode === "task";
              return (
                <g key={workstation.id}>
                  <circle
                    cx={`${position.x * 100}%`}
                    cy={`${position.y * 100}%`}
                    r={
                      dimmed
                        ? WORKSTATION_MARKER_RADIUS_DIMMED
                        : WORKSTATION_MARKER_RADIUS
                    }
                    className={dimmed ? "fill-border" : "fill-accent"}
                    stroke="var(--background)"
                    strokeWidth={1.5}
                  />
                  {!dimmed && (
                    <text
                      x={`${position.x * 100}%`}
                      y={`${position.y * 100}%`}
                      dy={-14}
                      textAnchor="middle"
                      className="fill-foreground text-[11px] font-semibold"
                      style={{
                        paintOrder: "stroke",
                        stroke: "var(--background)",
                        strokeWidth: 3,
                      }}
                    >
                      {workstation.name}
                    </text>
                  )}
                </g>
              );
            })}

            {mode === "task" &&
              workstations.flatMap((workstation) =>
                workstation.tasks.map((task) => {
                  const position = taskPositions[task.id];
                  if (!position) return null;
                  const selected = selectedTaskLabelId === task.id;
                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: decorative marker on a visual overlay — the task name is already exposed via the <title> hover tooltip below, and every task is also listed (with its name as plain text) in the sidebar.
                    <g
                      key={task.id}
                      className="pointer-events-auto cursor-pointer"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedTaskLabelId((current) =>
                          current === task.id ? null : task.id,
                        );
                      }}
                    >
                      <title>{task.name}</title>
                      <rect
                        x={`${position.x * 100}%`}
                        y={`${position.y * 100}%`}
                        width={TASK_MARKER_SIZE}
                        height={TASK_MARKER_SIZE}
                        transform={`translate(${-TASK_MARKER_SIZE / 2}, ${-TASK_MARKER_SIZE / 2})`}
                        className="fill-accent"
                        stroke="var(--background)"
                        strokeWidth={1.5}
                      />
                      {selected && (
                        <text
                          x={`${position.x * 100}%`}
                          y={`${position.y * 100}%`}
                          dy={-14}
                          textAnchor="middle"
                          className="fill-foreground text-[11px] font-semibold"
                          style={{
                            paintOrder: "stroke",
                            stroke: "var(--background)",
                            strokeWidth: 3,
                          }}
                        >
                          {task.name}
                        </text>
                      )}
                    </g>
                  );
                }),
              )}
          </svg>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-2">
          <h2 className="font-heading text-lg font-bold">
            {dict.workstationsHeading}
          </h2>

          {workstations.map((workstation) => {
            const isPlaced = Boolean(workstationPositions[workstation.id]);
            const isArmed =
              armedTarget?.kind === "workstation" &&
              armedTarget.id === workstation.id;
            const placedTaskCountForWs = workstation.tasks.filter(
              (t) => taskPositions[t.id],
            ).length;

            return (
              <div
                key={workstation.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                {mode === "task" ? (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(workstation.id)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold"
                  >
                    <span>{workstation.name}</span>
                    <span className="text-xs font-normal text-border">
                      {placedTaskCountForWs}/{workstation.tasks.length}{" "}
                      {dict.tasksPlacedSuffix}
                    </span>
                  </button>
                ) : (
                  <span className="text-sm font-semibold">
                    {workstation.name}
                  </span>
                )}

                {mode === "workstation" && (
                  <div className="mt-2 flex items-center gap-2">
                    {isPlaced ? (
                      <>
                        <span className="text-xs text-accent">
                          {dict.placedLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveWorkstation(workstation.id)
                          }
                          className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                        >
                          {dict.remove}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setArmedTarget({
                            kind: "workstation",
                            id: workstation.id,
                            name: workstation.name,
                          })
                        }
                        disabled={isArmed}
                        className="rounded border border-border px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
                      >
                        {dict.placeOnMap}
                      </button>
                    )}
                  </div>
                )}

                {mode === "task" &&
                  expandedWorkstationIds.has(workstation.id) && (
                    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                      {workstation.tasks.length === 0 ? (
                        <p className="text-xs text-border">{dict.noTasks}</p>
                      ) : (
                        workstation.tasks.map((task) => {
                          const taskPlaced = Boolean(taskPositions[task.id]);
                          const taskArmed =
                            armedTarget?.kind === "task" &&
                            armedTarget.id === task.id;
                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>{task.name}</span>
                              {taskPlaced ? (
                                <span className="flex items-center gap-2">
                                  <span className="text-xs text-accent">
                                    {dict.placedLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTask(task.id)}
                                    className="rounded border border-border px-2 py-1 text-xs hover:border-accent"
                                  >
                                    {dict.remove}
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setArmedTarget({
                                      kind: "task",
                                      id: task.id,
                                      name: task.name,
                                    })
                                  }
                                  disabled={taskArmed}
                                  className="rounded border border-border px-2 py-1 text-xs hover:border-accent disabled:opacity-50"
                                >
                                  {dict.placeOnMap}
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
