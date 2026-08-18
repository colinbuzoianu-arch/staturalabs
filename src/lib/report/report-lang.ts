import type { CountryCode } from "@/generated/prisma/enums";

// The two languages a generated report (task/risk-assessment/worker-
// briefing) can render in — deliberately a subset of Locale (no Romanian
// yet: "English is the safe default for now" per B8c,
// SLD_NEXT_STEPS_B8b-B8f.md §6), but every value here is still a valid
// Locale, so it can be passed straight into getCommonDictionary()/
// describeRegionResult()/describeManualInput() with no mapping step.
export type ReportLang = "en" | "de";

// Country-driven, not locale-driven — same philosophy as
// src/lib/report/sgd-availability.ts's resolveSgdCountryPack (§7 B5),
// extended here to a soft default rather than a hard gate: an AT-sited
// resource defaults to German, every other country defaults to English.
// A `?lang=` query param overrides the default either way, since a
// company_admin viewing an AT-sited report in an English-language UI
// session (or vice versa) may still want the other language's document.
export function resolveReportLang(
  country: CountryCode,
  requestedLang: string | null,
): ReportLang {
  if (requestedLang === "de" || requestedLang === "en") return requestedLang;
  return country === "AT" ? "de" : "en";
}
