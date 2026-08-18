import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import type { Locale } from "@/lib/i18n/locale";
import type { RegionResult } from "./types";

// Shared one-line rendering of a RegionResult — used by the capture page's
// immediate result view, PostureSampleSwitcher (both the (app) dashboard
// and the internal /admin tool), and every generated PDF report, so none
// of them drift into describing the same status differently.
//
// Locale-aware since B8c (SLD_NEXT_STEPS_B8b-B8f.md) — the RiskBand/
// CameraAngle values it interpolates, and the sentence structure around
// them, come from common/{locale}.ts's regionResultDetail/riskBandLabels/
// cameraAngleLabels rather than being hardcoded English, so a German
// dashboard (or a German-language report for an AT site) doesn't leak raw
// English through this one shared function. MediaPipe landmark property
// names inside the insufficient-visibility list (leftShoulder, rightKnee,
// ...) stay untranslated technical identifiers — they're MediaPipe's own
// API field names, not this app's vocabulary.
export function describeRegionResult(
  result: RegionResult,
  locale: Locale,
): string {
  const dict = getCommonDictionary(locale);
  switch (result.status) {
    case "scored":
      return `${result.degrees.toFixed(1)}° — ${dict.riskBandLabels[result.riskBand]} (${dict.regionResultDetail.scoreSuffix(result.riskScore)})`;
    case "wrong-camera-angle":
      return dict.regionResultDetail.wrongCameraAngle(
        result.requiredCameraAngle
          .map((angle) => dict.cameraAngleLabels[angle])
          .join("/"),
        dict.cameraAngleLabels[result.actualCameraAngle],
      );
    case "insufficient-visibility":
      return dict.regionResultDetail.insufficientVisibility(
        result.failedLandmarks
          .map((l) => `${l.name} (${(l.visibility * 100).toFixed(0)}%)`)
          .join(", "),
      );
    case "no-matching-rule":
      return `${result.degrees.toFixed(1)}° — ${dict.regionResultDetail.noThresholdMatched}`;
    case "not-yet-supported":
      return "—";
    // B11 (SLD_IMPLEMENTATION_PLAN_posture-input.md §3.3): the Status
    // column already carries "not assessed" via regionResultStatusLabels
    // — no need to repeat it here, same minimalism as not-yet-supported.
    case "not-assessed":
      return "—";
  }
}
