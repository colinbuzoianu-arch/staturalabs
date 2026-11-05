// P12 pure KPI rate/ratio formulas — no DB, unit-tested. Every one returns null
// when the denominator is missing or zero (an honest "—", never a divide-by-zero
// or a misleading 0). Display-only; never a scoring input.

export function ratePerThousand(
  count: number,
  headcount: number | null,
): number | null {
  if (!headcount || headcount <= 0) return null;
  return (count / headcount) * 1000;
}

export function ratePerMillionHours(
  count: number,
  hoursWorked: number | null,
): number | null {
  if (!hoursWorked || hoursWorked <= 0) return null;
  return (count / hoursWorked) * 1_000_000;
}

export function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

export function percentage(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return (part / whole) * 100;
}

// Round for display (KPIs are never compared to a threshold programmatically,
// so rounding here is purely cosmetic).
export function roundTo(value: number | null, dp: number): number | null {
  if (value === null) return null;
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}
