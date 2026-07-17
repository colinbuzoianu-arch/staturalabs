import type { RegionResult } from "./types";

// Shared one-line rendering of a RegionResult — used by the capture page's
// immediate result view and the admin task results view, so the two don't
// drift into describing the same status differently.
export function describeRegionResult(result: RegionResult): string {
  switch (result.status) {
    case "scored":
      return `${result.degrees.toFixed(1)}° — ${result.riskBand} (score ${result.riskScore})`;
    case "wrong-camera-angle":
      return `needs ${result.requiredCameraAngle.join("/")}, got ${result.actualCameraAngle}`;
    case "insufficient-visibility":
      return `low-confidence landmarks: ${result.failedLandmarks
        .map((l) => `${l.name} (${(l.visibility * 100).toFixed(0)}%)`)
        .join(", ")}`;
    case "no-matching-rule":
      return `${result.degrees.toFixed(1)}° — no threshold matched`;
    case "not-yet-supported":
      return "—";
  }
}
