// P8 §3.5 SDS alerts (SLD_P8_GEFAHRSTOFFE_APPROVED.md). Pure — unit-tested.
// Computed on read over a substance's SDS list + whether it is in active use.

export type SubstanceAlert = "no-current-sds" | "missing-de-sds" | "stale-sds";

export type SdsSnapshot = {
  language: string; // BCP-47, e.g. "de", "de-AT", "en"
  revisionDate: Date;
  supersededAt: Date | null;
};

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export function substanceSdsAlerts(params: {
  hasActiveUse: boolean;
  sdsList: readonly SdsSnapshot[];
  // AT/DE sites require a German SDS (REACH Art. 31(5)).
  siteRequiresDe: boolean;
  now: Date;
  staleYears: number;
}): SubstanceAlert[] {
  const alerts: SubstanceAlert[] = [];
  const current = params.sdsList.filter((s) => s.supersededAt === null);

  // Only substances in active use raise the statutory availability alerts.
  if (params.hasActiveUse) {
    if (current.length === 0) {
      alerts.push("no-current-sds");
    } else if (
      params.siteRequiresDe &&
      !current.some((s) => s.language.toLowerCase().startsWith("de"))
    ) {
      alerts.push("missing-de-sds");
    }
  }

  // Age (policy): any current SDS older than staleYears.
  const staleCutoff = new Date(
    params.now.getTime() - params.staleYears * MS_PER_YEAR,
  );
  if (current.some((s) => s.revisionDate < staleCutoff)) {
    alerts.push("stale-sds");
  }

  return alerts;
}
