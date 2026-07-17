// Provisions the client-side MediaPipe Pose Landmarker assets into /public,
// served from this app's own origin rather than an external CDN — shop-floor
// networks often block arbitrary external domains, and self-hosting also
// pins the exact weights the eventual accuracy validation study runs
// against (see ERGO_COMPLIANCE_BY_DESIGN.md §5).
//
// Run via `npm run predev` / `npm run prebuild` (wired in package.json).
// Output is gitignored (public/mediapipe/) — re-run this script rather than
// committing the binaries.
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outDir = path.join(projectRoot, "public", "mediapipe");

// Pinned to a specific Google Cloud Storage object generation — an
// immutable, versioned URL (the generation number never changes for a
// given object), not "latest". Bumping the model is a deliberate edit to
// this constant, not silent drift.
// Source: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
const POSE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const MODEL_FILENAME = "pose_landmarker_lite.task";

// Vendored via the @mediapipe/tasks-vision npm dependency (already pinned
// by package-lock.json) — copied locally rather than fetched, and rather
// than referenced from node_modules directly, so it's servable as a static
// asset from /public.
const WASM_SOURCE_DIR = path.join(
  projectRoot,
  "node_modules",
  "@mediapipe",
  "tasks-vision",
  "wasm",
);
const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

async function fetchModel() {
  const dest = path.join(outDir, MODEL_FILENAME);
  console.log(
    `Fetching Pose Landmarker model -> ${path.relative(projectRoot, dest)}`,
  );
  const res = await fetch(POSE_LANDMARKER_MODEL_URL);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Pose Landmarker model: ${res.status} ${res.statusText}`,
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);
}

async function copyWasmAssets() {
  const wasmOutDir = path.join(outDir, "wasm");
  await mkdir(wasmOutDir, { recursive: true });
  for (const file of WASM_FILES) {
    const from = path.join(WASM_SOURCE_DIR, file);
    const to = path.join(wasmOutDir, file);
    console.log(`Copying ${file} -> ${path.relative(projectRoot, to)}`);
    await copyFile(from, to);
  }
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await fetchModel();
  await copyWasmAssets();
  console.log("MediaPipe assets ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
