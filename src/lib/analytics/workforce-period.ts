import "server-only";

import type { WorkforcePeriodType } from "@/generated/prisma/enums";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P14 G1: set one site's (optionally one org-unit's) workforce figures for a
// period — the denominators for the accident rates. A plain figure (not a count
// of Person rows; ERGO §3.18). Audited. Entered via the KPI cockpit (annual) or
// bulk-imported per period (G3). Keyed by site + orgUnit + periodType + year +
// periodIndex; a find-then-write because the uniqueness is a hand-added partial
// index Prisma can't target with upsert.

// A YEAR row carries periodIndex 0; a MONTH 1-12, a QUARTER 1-4 (the DB CHECK
// enforces the range). Callers pass the index that matches the type.
export function periodIndexForYear(): number {
  return 0;
}

export async function setSiteWorkforcePeriod(input: {
  siteId: string;
  companyId: string;
  orgUnitId: string | null;
  periodType: WorkforcePeriodType;
  year: number;
  periodIndex: number;
  headcount: number | null;
  hoursWorked: number | null;
  actorUserId: string | null;
}): Promise<void> {
  const existing = await prisma.siteWorkforcePeriod.findFirst({
    where: {
      siteId: input.siteId,
      orgUnitId: input.orgUnitId,
      periodType: input.periodType,
      year: input.year,
      periodIndex: input.periodIndex,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.siteWorkforcePeriod.update({
      where: { id: existing.id },
      data: {
        headcount: input.headcount,
        hoursWorked: input.hoursWorked,
        setByUserId: input.actorUserId,
        setAt: new Date(),
      },
    });
  } else {
    await prisma.siteWorkforcePeriod.create({
      data: {
        siteId: input.siteId,
        orgUnitId: input.orgUnitId,
        periodType: input.periodType,
        year: input.year,
        periodIndex: input.periodIndex,
        headcount: input.headcount,
        hoursWorked: input.hoursWorked,
        setByUserId: input.actorUserId,
      },
    });
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "site_workforce_period.set",
    entityType: "SiteWorkforcePeriod",
    companyId: input.companyId,
    siteId: input.siteId,
    diff: {
      orgUnitId: input.orgUnitId,
      periodType: input.periodType,
      year: input.year,
      periodIndex: input.periodIndex,
      headcount: input.headcount,
      hoursWorked: input.hoursWorked,
    },
  });
}
