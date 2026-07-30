// Client-only: loads the MediaPipe Pose Landmarker WASM runtime + model.
// Never imported by server code — only by the capture page ('use client').

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Self-hosted assets (see scripts/fetch-pose-model.mjs) — served from this
// app's own origin, not an external CDN. Re-run that script (wired into
// npm run predev / prebuild) after changing either path.
const WASM_BASE_PATH = "/mediapipe/wasm";
const MODEL_ASSET_PATH = "/mediapipe/pose_landmarker_lite.task";

// Multi-person support requires this to be >1 — at 1, MediaPipe would
// silently return only the single most confident detection and discard
// everyone else in frame, exactly the silent behavior this capture flow
// is built to avoid.
const MAX_POSES = 3;

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

// Which delegate actually initialized — GPU is preferred (faster), but
// mobile browsers are exactly where the GPU delegate is most likely to
// fail, per the M0 spike notes. Exposed so the capture page can surface it
// in dev, not shown to the operator in production.
let activeDelegate: "GPU" | "CPU" | null = null;
export function getActivePoseDelegate(): "GPU" | "CPU" | null {
  return activeDelegate;
}

async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);

  try {
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: "GPU" },
      runningMode: "IMAGE",
      numPoses: MAX_POSES,
    });
    activeDelegate = "GPU";
    return landmarker;
  } catch (gpuError) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[pose] GPU delegate failed, retrying with CPU:", gpuError);
    }
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: "CPU" },
      runningMode: "IMAGE",
      numPoses: MAX_POSES,
    });
    activeDelegate = "CPU";
    return landmarker;
  }
}

// Lazily creates (and caches — one instance per page load) a PoseLandmarker
// running in IMAGE mode. Capture is operator-triggered (one explicit
// "Capture Sample" click per sample), not continuous video tracking, so a
// single synchronous detect() call per capture is the correct mode —
// detectForVideo's continuous-stream mode would be the wrong fit here.
export function getPoseLandmarker(): Promise<PoseLandmarker> {
  poseLandmarkerPromise ??= createPoseLandmarker().catch((error) => {
    // Don't cache a permanent failure — if both delegates failed (e.g. a
    // transient WASM/network hiccup fetching the model), a later retry
    // (reload, or a future retry affordance) should get a fresh attempt
    // rather than being stuck replaying the same rejected promise forever.
    poseLandmarkerPromise = null;
    throw error;
  });
  return poseLandmarkerPromise;
}
