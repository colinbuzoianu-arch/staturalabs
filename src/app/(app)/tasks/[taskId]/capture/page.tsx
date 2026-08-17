"use client";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import Link from "next/link";
import {
  type FormEvent,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CameraAngle, ManualInputType } from "@/generated/prisma/enums";
import { describeRegionResult } from "@/lib/capture/describe-region-result";
import type { ManualAngles } from "@/lib/capture/manual-angles";
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
import { COMPUTED_BODY_REGIONS } from "@/lib/pose/angles";
import { boundingBox, drawSkeleton } from "@/lib/pose/draw-skeleton";
import {
  getActivePoseDelegate,
  getPoseLandmarker,
} from "@/lib/pose/mediapipe-client";
import { NOT_ASSESSED_COLOR, riskBandColors } from "@/lib/risk/band-severity";
import { matchScoringRule } from "@/lib/scoring/match";

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

type EntryMode = "camera" | "manual";

export default function CapturePage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const { locale } = useLocale();
  const dict = getDashboardDictionary(locale).capturePage;

  // Which flow is showing — the camera phase machine below, or
  // ManualAngleEntryPanel further down this file
  // (SLD_IMPLEMENTATION_PLAN_austria-first.md §5). Defaults to "camera":
  // the camera path stays the primary, unchanged experience for anyone
  // who doesn't switch tabs — CLAUDE.md "Frozen and demoted work" is
  // about priority and new-feature focus, not about hiding a path that
  // still works.
  const [mode, setMode] = useState<EntryMode>("camera");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>(
    CameraAngle.SAGITTAL,
  );
  // Optional — how long this specific posture was held, in seconds
  // (SLD_IMPLEMENTATION_PLAN_austria-first.md §6). Blank means "not
  // recorded," a legitimate, common case, not an error.
  const [holdDurationSeconds, setHoldDurationSeconds] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [noPersonNotice, setNoPersonNotice] = useState(false);
  const [poseDelegate, setPoseDelegate] = useState<"GPU" | "CPU" | null>(null);

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
        if (!cancelled) {
          setPhase((p) => (p.kind === "loading" ? { kind: "ready" } : p));
          setPoseDelegate(getActivePoseDelegate());
        }
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
        // `ideal`, not `exact`: a soft constraint the browser honors when it
        // can (routing a phone to its rear camera, the one actually useful
        // for filming someone at 3-5m) and silently ignores otherwise — a
        // desktop/USB camera with no environment-facing device just falls
        // back to its normal default, so this changes nothing there.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
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
            holdDurationSeconds:
              holdDurationSeconds.trim() === ""
                ? null
                : Number(holdDurationSeconds),
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
    [cameraAngle, taskId, dict, holdDurationSeconds],
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

      {/* Capture vs. manual entry — a tab on this same page, not a
          separate route (SLD_IMPLEMENTATION_PLAN_austria-first.md §5).
          "Camera" stays the default tab; switching tabs never resets
          either flow's own in-progress state (the video element below
          stays mounted throughout — see its own comment — and
          ManualAngleEntryPanel keeps its own state internally). */}
      <div role="tablist" aria-label="Entry mode" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "camera"}
          onClick={() => setMode("camera")}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${
            mode === "camera"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          {dict.captureTabLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "manual"}
          onClick={() => setMode("manual")}
          className={`rounded-md px-4 py-2 text-sm font-semibold ${
            mode === "manual"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          {dict.manualEntryTabLabel}
        </button>
      </div>

      {mode === "camera" && phase.kind === "error" && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
          {phase.message}
        </div>
      )}

      {/*
        Always mounted, regardless of phase OR mode — never conditionally
        rendered. Its srcObject is attached once, in the camera-setup
        effect above; if this element were unmounted (e.g. only rendered
        outside "selecting"/"result", or while the Manual entry tab is
        active) and later remounted, that assignment wouldn't re-run, and
        the fresh <video> would sit at 0x0 until manually reattached. A
        capture off a 0x0 frame doesn't fail cleanly — MediaPipe's native
        code throws an opaque "ROI width and height must be > 0" error deep
        inside detect() (this is exactly the "second capture" bug this
        component used to have: the result screen unmounted the element,
        and returning to capture another sample remounted it with no
        stream). Hidden via CSS during "selecting"/"result"/the Manual
        entry tab, not unmounted.
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        hidden={
          mode !== "camera" ||
          phase.kind === "selecting" ||
          phase.kind === "result"
        }
        className="w-full rounded border bg-black"
      />

      {mode === "camera" && (
        <>
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
                    onChange={(e) =>
                      setCameraAngle(e.target.value as CameraAngle)
                    }
                  >
                    {CAMERA_ANGLE_OPTIONS.map((angle) => (
                      <option key={angle} value={angle}>
                        {angle}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  {dict.holdDurationLabel}
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder={dict.holdDurationPlaceholder}
                    value={holdDurationSeconds}
                    onChange={(e) => setHoldDurationSeconds(e.target.value)}
                    className="rounded border px-2 py-1"
                  />
                </label>
              </div>

              {/* Which regions score at all depends on this being right (see
                  computeBodyAngles's camera-angle gate) — unmissable on a phone,
                  not just implied by the dropdown label. */}
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {dict.cameraAngleHint[cameraAngle]}
              </p>

              {/* Dev-only: which MediaPipe delegate actually initialized — the
                  GPU delegate failing silently on mobile with no fallback was
                  the top suspected M0 risk; this makes a CPU fallback visible
                  during testing instead of indistinguishable from GPU. */}
              {process.env.NODE_ENV !== "production" && poseDelegate && (
                <p className="font-mono text-xs text-zinc-400">
                  pose delegate: {poseDelegate}
                </p>
              )}

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
        </>
      )}

      {mode === "manual" && <ManualAngleEntryPanel taskId={taskId} />}

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
  const holdTime = response.holdTime;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {dict.sampleMeta(response.postureSampleId, response.methodologyVersion)}
      </p>
      {holdTime && (
        <p className="text-sm">
          {dict.holdTimeSummary(
            holdTime.holdDurationSeconds,
            holdTime.worstPostureBand,
          )}{" "}
          {holdTime.holdTimeBand && (
            <span className="font-bold text-red-700 dark:text-red-400">
              {dict.holdTimeEscalated(holdTime.overallBand)}
            </span>
          )}
        </p>
      )}
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

// Mirrors GET /api/scoring-rules's response shape exactly (see that
// route's own comment) — field names match ScoringRule's own columns so a
// fetched row satisfies matchScoringRule's AngleRangeRule with no mapping
// step. Defined locally rather than imported from the frozen posture
// editor's ScoringRuleRow (src/lib/pose/posture-editor.ts, which this
// panel deliberately doesn't depend on — see SLD_POSTURE_EDITOR_FIDELITY
// _PLAN.md) so this feature has zero coupling to that frozen module.
type ScoringRulePreviewRow = {
  bodyRegion: (typeof COMPUTED_BODY_REGIONS)[number];
  angleMin: number | null;
  angleMax: number | null;
  riskBand: "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
  riskScore: number;
};

// Manual posture entry (SLD_IMPLEMENTATION_PLAN_austria-first.md §5): the
// goniometer/tape-measure alternative to the camera flow above — an
// ergonomist can produce a fully scored, fully traceable PostureSample
// with the camera never opened. All 8 computed regions are required
// (mirrors createPostureSample's own validateManualAngles gate; the
// per-region live-band feedback below is the actual reason a real
// assessor would want this over the plain camera capture page: they see
// the methodology's judgment as they type, rather than after a
// round-trip).
function ManualAngleEntryPanel({ taskId }: { taskId: string }) {
  const { locale } = useLocale();
  const dict = getDashboardDictionary(locale).capturePage;

  const [rules, setRules] = useState<ScoringRulePreviewRow[] | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [angleInputs, setAngleInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(COMPUTED_BODY_REGIONS.map((region) => [region, ""])),
  );
  const [holdDurationSeconds, setHoldDurationSeconds] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PostureSampleResponse | null>(null);

  // Fetched once — the active rule set is fixed for the life of this
  // panel, so every keystroke afterward matches locally
  // (matchScoringRule, the same pure per-row range check the server uses)
  // with zero further round-trips.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/scoring-rules")
      .then((res) => {
        if (!res.ok) throw new Error(dict.requestFailed(res.status));
        return res.json() as Promise<{ rules: ScoringRulePreviewRow[] }>;
      })
      .then((data) => {
        if (!cancelled) setRules(data.rules);
      })
      .catch((err) => {
        if (!cancelled) {
          setRulesError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dict]);

  const rulesByRegion = useMemo(() => {
    const map = new Map<string, ScoringRulePreviewRow[]>();
    for (const rule of rules ?? []) {
      const existing = map.get(rule.bodyRegion) ?? [];
      existing.push(rule);
      map.set(rule.bodyRegion, existing);
    }
    return map;
  }, [rules]);

  function livePreview(region: string) {
    const raw = angleInputs[region]?.trim();
    if (!raw) return null;
    const degrees = Number(raw);
    if (!Number.isFinite(degrees)) return null;
    return matchScoringRule(rulesByRegion.get(region) ?? [], degrees);
  }

  const allFilled = COMPUTED_BODY_REGIONS.every((region) => {
    const raw = angleInputs[region]?.trim();
    return !!raw && Number.isFinite(Number(raw));
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const angles: Partial<ManualAngles> = {};
      for (const region of COMPUTED_BODY_REGIONS) {
        angles[region] = Number(angleInputs[region]);
      }
      const res = await fetch("/api/posture-samples/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          angles,
          taskId,
          holdDurationSeconds:
            holdDurationSeconds.trim() === ""
              ? null
              : Number(holdDurationSeconds),
        }),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error ?? dict.requestFailed(res.status));
      }
      setResponse((await res.json()) as PostureSampleResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResponse(null);
    setAngleInputs(
      Object.fromEntries(COMPUTED_BODY_REGIONS.map((region) => [region, ""])),
    );
    setHoldDurationSeconds("");
  }

  if (response) {
    return (
      <ResultView
        response={response}
        onCaptureAnother={reset}
        dict={{ ...dict, captureAnother: dict.manualEntryAnother }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{dict.manualEntryHeading}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {dict.manualEntryDescription}
        </p>
      </div>

      {rulesError && (
        <p className="text-sm text-red-700 dark:text-red-400">
          {dict.manualEntryRulesFailed(rulesError)}
        </p>
      )}
      {!rules && !rulesError && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {dict.manualEntryRulesLoading}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {COMPUTED_BODY_REGIONS.map((region) => {
          const preview = livePreview(region);
          return (
            <label key={region} className="flex flex-col gap-1 text-sm">
              {dict.angleDegreesLabel(region)}
              <input
                type="number"
                step="any"
                required
                value={angleInputs[region] ?? ""}
                onChange={(e) =>
                  setAngleInputs((prev) => ({
                    ...prev,
                    [region]: e.target.value,
                  }))
                }
                className="rounded border px-2 py-1"
              />
              <span
                className="font-technical text-xs font-bold"
                style={{
                  color: preview
                    ? riskBandColors[preview.riskBand]
                    : NOT_ASSESSED_COLOR,
                }}
              >
                {preview
                  ? `${preview.riskBand} (${preview.riskScore})`
                  : dict.manualEntryNotScored}
              </span>
            </label>
          );
        })}
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-sm">
        {dict.holdDurationLabel}
        <input
          type="number"
          min={0}
          step="any"
          placeholder={dict.holdDurationPlaceholder}
          value={holdDurationSeconds}
          onChange={(e) => setHoldDurationSeconds(e.target.value)}
          className="rounded border px-2 py-1"
        />
      </label>

      <button
        type="submit"
        disabled={!allFilled || submitting || !rules}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {submitting ? dict.manualEntrySubmitting : dict.manualEntrySubmit}
      </button>
    </form>
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
