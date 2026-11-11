// P14 G1: aggregate SiteWorkforcePeriod rows into the single headcount + hours
// denominators the P12 accident rates need, over a scope (one or more sites) and
// a year. Pure, no DB — unit-tested directly.
//
// The two figures aggregate differently because they are different kinds of
// quantity:
//   - hoursWorked is a FLOW: additive over both time (months/quarters within a
//     year) and sites → sum every present value.
//   - headcount is a STOCK (Personalstand): NOT additive over time — twelve
//     monthly head-counts of 50 is a workforce of 50, not 600. So per site we
//     take the MEAN of its present period head-counts, then SUM those per-site
//     means across the scope's sites (each site contributes its own workforce).
// A missing figure is never fabricated: if no row carries a value, the result is
// null and the dependent rate shows an honest "—" (P14 §G1, ERGO §3.15).

export type WorkforceRow = {
  siteId: string;
  headcount: number | null;
  hoursWorked: number | null;
};

export type WorkforceTotals = {
  headcount: number | null;
  hoursWorked: number | null;
};

export function aggregateWorkforce(rows: WorkforceRow[]): WorkforceTotals {
  const hours = rows
    .map((r) => r.hoursWorked)
    .filter((h): h is number => h !== null);
  const hoursWorked =
    hours.length > 0 ? hours.reduce((a, b) => a + b, 0) : null;

  // Per-site mean head-count, then sum the per-site means.
  const bySite = new Map<string, number[]>();
  for (const r of rows) {
    if (r.headcount === null) continue;
    const list = bySite.get(r.siteId) ?? [];
    list.push(r.headcount);
    bySite.set(r.siteId, list);
  }
  let headcount: number | null = null;
  if (bySite.size > 0) {
    let total = 0;
    for (const list of bySite.values()) {
      total += list.reduce((a, b) => a + b, 0) / list.length;
    }
    headcount = Math.round(total);
  }

  return { headcount, hoursWorked };
}
