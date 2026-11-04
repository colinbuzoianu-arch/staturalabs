import type { RetentionBasis } from "@/generated/prisma/enums";

// P7d §C retention core (SLD_P7B_DEFERRALS_RESOLVED.md). Pure — ISO-8601
// duration parsing/arithmetic + rule resolution (company setting wins but is
// never shorter than a statutory minimum). No DB; unit-tested.

export type Duration = { years: number; months: number; days: number };

const ISO = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?$/;

// Parse an ISO-8601 duration like "P10Y", "P6M", "P30D", "P1Y6M". Returns null
// for an empty/invalid string.
export function parseIsoDuration(
  s: string | null | undefined,
): Duration | null {
  if (!s) return null;
  const m = ISO.exec(s);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return {
    years: m[1] ? Number.parseInt(m[1], 10) : 0,
    months: m[2] ? Number.parseInt(m[2], 10) : 0,
    days: m[3] ? Number.parseInt(m[3], 10) : 0,
  };
}

// Add a duration to a date (UTC), clamping the day to the target month length
// (same convention as computeNextReviewDate).
export function addDuration(base: Date, dur: Duration): Date {
  const targetMonthIndex = base.getUTCMonth() + dur.years * 12 + dur.months;
  const targetYear = base.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const day = Math.min(base.getUTCDate(), lastDay);
  const d = new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      base.getUTCHours(),
      base.getUTCMinutes(),
      base.getUTCSeconds(),
    ),
  );
  return new Date(d.getTime() + dur.days * 24 * 60 * 60 * 1000);
}

// Approximate length in days, for comparing two durations (year≈365, month≈30).
export function durationToDays(dur: Duration): number {
  return dur.years * 365 + dur.months * 30 + dur.days;
}

export type ResolvedRetention = {
  retention: string | null; // ISO duration, null = no period / keep indefinitely
  basis: RetentionBasis;
};

// Resolve the effective retention for a record type: the company setting wins,
// but it may never be SHORTER than a statutory minimum from the catalogue. If
// there is no company setting, fall back to the catalogue's minRetention (null
// = no period). The basis reported is STATUTORY when a statutory floor exists,
// else the catalogue basis (or POLICY_DEFAULT when only a company setting).
export function resolveEffectiveRetention(input: {
  companySettingRetention: string | null;
  catalogBasis: RetentionBasis | null;
  catalogMinRetention: string | null;
}): ResolvedRetention {
  const statutoryMin =
    input.catalogBasis === "STATUTORY"
      ? parseIsoDuration(input.catalogMinRetention)
      : null;

  if (input.companySettingRetention) {
    const company = parseIsoDuration(input.companySettingRetention);
    // Never shorter than a statutory floor.
    if (
      statutoryMin &&
      company &&
      durationToDays(company) < durationToDays(statutoryMin)
    ) {
      return {
        retention: input.catalogMinRetention,
        basis: "STATUTORY",
      };
    }
    return {
      retention: input.companySettingRetention,
      basis: statutoryMin ? "STATUTORY" : "POLICY_DEFAULT",
    };
  }

  return {
    retention: input.catalogMinRetention,
    basis: input.catalogBasis ?? "NO_STATUTORY_PERIOD",
  };
}

// The date a record's retention matures (trigger date + retention). null
// retention → never matures (returns null).
export function retentionDueDate(
  triggerDate: Date,
  retention: string | null,
): Date | null {
  const dur = parseIsoDuration(retention);
  if (!dur) return null;
  return addDuration(triggerDate, dur);
}

// Has retention matured as of `now`? Never (false) when there is no trigger
// date or no period.
export function isRetentionMatured(
  triggerDate: Date | null,
  retention: string | null,
  now: Date,
): boolean {
  if (!triggerDate) return false;
  const due = retentionDueDate(triggerDate, retention);
  if (!due) return false;
  return due <= now;
}
