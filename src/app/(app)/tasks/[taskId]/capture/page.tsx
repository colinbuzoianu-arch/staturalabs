"use client";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import Link from "next/link";
import {
  type FormEvent,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CameraAngle, ManualInputType } from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import {
  describeManualInput,
  isTextManualInputType,
  MANUAL_INPUT_TYPES,
  MANUAL_INPUT_UNITS,
  validateManualInputShape,
} from "@/lib/capture/manual-input";
import type { PostureSampleResponse, RegionResult } from "@/lib/capture/types";
import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { useLocale } from "@/lib/i18n/locale-context";
import { boundingBox, drawSkeleton } from "@/lib/pose/draw-skeleton";
import { getPoseLandmarker } from "@/lib/pose/mediapipe-client";

// A stable id assigned once per detected person, so the picker below has a
// real React key instead of the raw array index.
type PersonCandidate = { id: number; landmarks: NormalizedLandmark[] };

type Phase =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "detecting" }
  | { kind: "selecting"; frame: ImageBitmap; candidates: PersonCandidate[] }
  | { kind: "submitting" }
  | { kind: "result"; response: PostureSampleResponse }
  | { kind: "error"; message: string };

const CAMERA_ANGLE_OPTIONS = Object.values(CameraAngle);
const SKELETON_COLORS = ["#22d3ee", "#f97316", "#a3e635"];

export default function CapturePage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const { locale } = useLocale();
  const dict = getDashboardDictionary(locale).capturePage;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>(
    CameraAngle.SAGITTAL,
  );
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [noPersonNotice, setNoPersonNotice] = useState(false);

  const stopCurrentStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;
  }, []);

  // Warm up the pose model as soon as the page loads, in parallel with
  // camera setup, so it's ready by the time the operator clicks Capture.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dict is a stable reference per locale (singleton dictionaries), but adding it here would re-run camera/model setup on every language switch — only run this once on mount.
  useEffect(() => {
    let cancelled = false;
    getPoseLandmarker()
      .then(() => {
        if (!cancelled)
          setPhase((p) => (p.kind === "loading" ? { kind: "ready" } : p));
      })
      .catch((err) => {
        if (!cancelled) {
          setPhase({
            kind: "error",
            message: dict.failedToLoadPoseModel(
              err instanceof Error ? err.message : String(err),
            ),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Starts a camera stream and enumerates devices. Device labels are only
  // populated after a getUserMedia permission grant, so this requests a
  // default stream first, then re-enumerates with labels available.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dict is a stable reference per locale (singleton dictionaries), but adding it here would restart the camera stream on every language switch — only stopCurrentStream is a real dependency.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);
        const currentDeviceId = stream
          .getVideoTracks()[0]
          ?.getSettings().deviceId;
        setDeviceId(currentDeviceId ?? videoInputs[0]?.deviceId ?? "");
      } catch (err) {
        if (!cancelled) {
          setPhase({
            kind: "error",
            message: dict.cameraAccessFailed(
              err instanceof Error ? err.message : String(err),
            ),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      stopCurrentStream();
    };
  }, [stopCurrentStream]);

  const switchDevice = useCallback(
    async (nextDeviceId: string) => {
      setDeviceId(nextDeviceId);
      stopCurrentStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextDeviceId } },
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setPhase({
          kind: "error",
          message: dict.couldNotSwitchCamera(
            err instanceof Error ? err.message : String(err),
          ),
        });
      }
    },
    [stopCurrentStream, dict],
  );

  const submitLandmarks = useCallback(
    async (landmarks: readonly NormalizedLandmark[]) => {
      setPhase({ kind: "submitting" });
      try {
        const res = await fetch("/api/posture-samples", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Only the confirmed skeleton's 33 landmarks go over the wire —
          // never the captured frame, the full multi-person candidate set,
          // or which index was picked.
          body: JSON.stringify({
            landmarks: landmarks.map((l) => ({
              x: l.x,
              y: l.y,
              z: l.z,
              visibility: l.visibility,
            })),
            cameraAngle,
            taskId,
          }),
        });
        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          throw new Error(errorBody?.error ?? dict.requestFailed(res.status));
        }
        const response = (await res.json()) as PostureSampleResponse;
        setPhase({ kind: "result", response });
      } catch (err) {
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : dict.submitFailed,
        });
      }
    },
    [cameraAngle, taskId, dict],
  );

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setNoPersonNotice(false);

    // Guards against handing MediaPipe a 0x0 frame (its native code fails
    // with an opaque "ROI width and height must be > 0" error rather than
    // a catchable JS exception) — most likely if the stream hasn't
    // attached/loaded metadata yet.
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setPhase({
        kind: "error",
        message: dict.cameraFeedNotReady,
      });
      return;
    }

    setPhase({ kind: "detecting" });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setPhase({ kind: "error", message: dict.canvasUnavailable });
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const landmarker = await getPoseLandmarker();
      const result = landmarker.detect(canvas);

      if (result.landmarks.length === 0) {
        setNoPersonNotice(true);
        setPhase({ kind: "ready" });
        return;
      }

      if (result.landmarks.length === 1) {
        await submitLandmarks(result.landmarks[0]);
        return;
      }

      // More than one person: require an explicit pick before anything is
      // sent onward. The frame bitmap and the full candidate set below
      // only ever live in this component's state, to render the picker —
      // never part of the API request (see submitLandmarks).
      const frame = await createImageBitmap(canvas);
      const candidates = result.landmarks.map((landmarks, id) => ({
        id,
        landmarks,
      }));
      setPhase({ kind: "selecting", frame, candidates });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : dict.detectionFailed,
      });
    }
  }, [submitLandmarks, dict]);

  const reset = useCallback(() => setPhase({ kind: "ready" }), []);

  const busy =
    phase.kind === "loading" ||
    phase.kind === "detecting" ||
    phase.kind === "submitting";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      {/* Reached from two places (the (app) dashboard's task page and the
          internal /admin task results page), so this always points back
          to the (app) dashboard task page specifically — the canonical
          home for a task, reachable by every role that can reach this
          capture page in the first place (canAccessSite covers
          super_admin too). */}
      <Link href={`/tasks/${taskId}`} className="self-start text-sm underline">
        {dict.backToTask}
      </Link>
      <h1 className="text-xl font-semibold">{dict.heading}</h1>

      {phase.kind === "error" && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
          {phase.message}
        </div>
      )}

      {/*
        Always mounted, regardless of phase — never conditionally rendered.
        Its srcObject is attached once, in the camera-setup effect above; if
        this element were unmounted (e.g. only rendered outside "selecting"/
        "result") and later remounted, that assignment wouldn't re-run, and
        the fresh <video> would sit at 0x0 until manually reattached. A
        capture off a 0x0 frame doesn't fail cleanly — MediaPipe's native
        code throws an opaque "ROI width and height must be > 0" error deep
        inside detect() (this is exactly the "second capture" bug this
        component used to have: the result screen unmounted the element,
        and returning to capture another sample remounted it with no
        stream). Hidden via CSS during "selecting"/"result", not unmounted.
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        hidden={phase.kind === "selecting" || phase.kind === "result"}
        className="w-full rounded border bg-black"
      />

      {phase.kind !== "selecting" && phase.kind !== "result" && (
        <>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm">
              {dict.cameraLabel}
              <select
                className="rounded border px-2 py-1"
                value={deviceId}
                onChange={(e) => switchDevice(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {dict.cameraAngleLabel}
              <select
                className="rounded border px-2 py-1"
                value={cameraAngle}
                onChange={(e) => setCameraAngle(e.target.value as CameraAngle)}
              >
                {CAMERA_ANGLE_OPTIONS.map((angle) => (
                  <option key={angle} value={angle}>
                    {angle}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {noPersonNotice && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {dict.noPersonDetected}
            </p>
          )}

          <button
            type="button"
            onClick={handleCapture}
            disabled={busy}
            className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {phase.kind === "loading"
              ? dict.loadingPoseModel
              : phase.kind === "detecting"
                ? dict.detecting
                : phase.kind === "submitting"
                  ? dict.submitting
                  : dict.captureSample}
          </button>
        </>
      )}

      {phase.kind === "selecting" && (
        <SkeletonPicker
          frame={phase.frame}
          candidates={phase.candidates}
          onSelect={(candidate) => submitLandmarks(candidate.landmarks)}
          onCancel={reset}
          dict={dict}
        />
      )}

      {phase.kind === "result" && (
        <ResultView
          response={phase.response}
          onCaptureAnother={reset}
          dict={dict}
        />
      )}

      {/*
        Independent of the pose-capture phase machine above — the operator
        can record a manual input before or after taking a posture sample,
        or without taking one at all in this visit. Always visible, never
        gated by `phase`.
      */}
      <ManualInputPanel taskId={taskId} />
    </div>
  );
}

type CaptureDict = ReturnType<typeof getDashboardDictionary>["capturePage"];

function SkeletonPicker({
  frame,
  candidates,
  onSelect,
  onCancel,
  dict,
}: {
  frame: ImageBitmap;
  candidates: PersonCandidate[];
  onSelect: (candidate: PersonCandidate) => void;
  onCancel: () => void;
  dict: CaptureDict;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(frame, 0, 0);
    for (const candidate of candidates) {
      drawSkeleton(
        ctx,
        candidate.landmarks,
        canvas.width,
        canvas.height,
        SKELETON_COLORS[candidate.id % SKELETON_COLORS.length],
      );
    }
  }, [frame, candidates]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{dict.peopleDetected(candidates.length)}</p>
      <div className="relative">
        <canvas ref={canvasRef} className="w-full rounded border" />
        {candidates.map((candidate) => {
          const box = boundingBox(candidate.landmarks);
          return (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelect(candidate)}
              aria-label={dict.selectPerson(candidate.id + 1)}
              style={{
                position: "absolute",
                left: `${box.minX * 100}%`,
                top: `${box.minY * 100}%`,
                width: `${(box.maxX - box.minX) * 100}%`,
                height: `${(box.maxY - box.minY) * 100}%`,
                border: `2px solid ${SKELETON_COLORS[candidate.id % SKELETON_COLORS.length]}`,
              }}
              className="rounded bg-transparent"
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="self-start text-sm underline"
      >
        {dict.cancelAndRetake}
      </button>
    </div>
  );
}

function ResultView({
  response,
  onCaptureAnother,
  dict,
}: {
  response: PostureSampleResponse;
  onCaptureAnother: () => void;
  dict: CaptureDict;
}) {
  const regions = Object.entries(response.regions) as [string, RegionResult][];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {dict.sampleMeta(response.postureSampleId, response.methodologyVersion)}
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-1 pr-4">{dict.tableRegion}</th>
            <th className="py-1 pr-4">{dict.tableStatus}</th>
            <th className="py-1">{dict.tableDetail}</th>
          </tr>
        </thead>
        <tbody>
          {regions.map(([region, result]) => (
            <tr key={region} className="border-b last:border-0">
              <td className="py-1 pr-4">{region}</td>
              <td className="py-1 pr-4">{result.status}</td>
              <td className="py-1">{describeRegionResult(result)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={onCaptureAnother}
        className="self-start rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
      >
        {dict.captureAnother}
      </button>
    </div>
  );
}

type ManualInputRecord = {
  id: string;
  inputType: ManualInputType;
  value: number | null;
  unit: string | null;
  textValue: string | null;
  notes: string | null;
};

function describeManualInputWithNotes(entry: ManualInputRecord): string {
  const base = describeManualInput(entry);
  return entry.notes ? `${base} — ${entry.notes}` : base;
}

// Creation-only, matching the read-only stance on Company/Site/Workstation
// /Task elsewhere in this dashboard pass — no editing or deleting an
// already-recorded row here. The authoritative history view is the task
// page (src/app/(app)/tasks/[taskId]/page.tsx); addedThisVisit below is
// just immediate feedback for what was just submitted, not fetched from
// the server and not persisted in this component across a reload.
function ManualInputPanel({ taskId }: { taskId: string }) {
  const { locale } = useLocale();
  const dashboardDict = getDashboardDictionary(locale);
  const dict = dashboardDict.capturePage;
  const manualInputLabels = dashboardDict.manualInputLabels;

  const [inputType, setInputType] = useState<ManualInputType>(
    ManualInputType.LOAD_WEIGHT_KG,
  );
  const [numericValue, setNumericValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedThisVisit, setAddedThisVisit] = useState<ManualInputRecord[]>([]);

  const isText = isTextManualInputType(inputType);
  const unit = MANUAL_INPUT_UNITS[inputType] ?? null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedValue = isText ? null : Number(numericValue);
    const shape = {
      inputType,
      value: isText ? null : Number.isFinite(parsedValue) ? parsedValue : null,
      unit: isText ? null : unit,
      textValue: isText ? textValue.trim() || null : null,
    };

    const shapeError = validateManualInputShape(shape);
    if (shapeError) {
      setError(shapeError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/manual-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...shape, taskId, notes: notes.trim() || null }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error ?? dict.requestFailed(res.status));
      }
      const { manualInput } = (await res.json()) as {
        manualInput: ManualInputRecord;
      };
      setAddedThisVisit((prev) => [manualInput, ...prev]);
      setNumericValue("");
      setTextValue("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-lg font-semibold">{dict.manualInputsHeading}</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {dict.manualInputsDescription}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {dict.typeLabel}
          <select
            className="rounded border px-2 py-1"
            value={inputType}
            onChange={(e) => setInputType(e.target.value as ManualInputType)}
          >
            {MANUAL_INPUT_TYPES.map((type) => (
              <option key={type} value={type}>
                {manualInputLabels[type]}
              </option>
            ))}
          </select>
        </label>

        {isText ? (
          <label className="flex flex-col gap-1 text-sm">
            {dict.toolLabel}
            <input
              type="text"
              required
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            {dict.valueLabel(unit)}
            <input
              type="number"
              step="any"
              required
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          {dict.notesLabel}
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded border px-4 py-2 disabled:opacity-50"
        >
          {submitting ? dict.adding : dict.add}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      {addedThisVisit.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {addedThisVisit.map((entry) => (
            <li key={entry.id} className="text-zinc-700 dark:text-zinc-300">
              {manualInputLabels[entry.inputType]}:{" "}
              {describeManualInputWithNotes(entry)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
