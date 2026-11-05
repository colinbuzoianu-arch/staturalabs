import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";

// P12: set a site's per-year headcount + hours worked — the denominators for
// accident rates. A plain figure (not a count of Person rows). Audited.
export async function setSitePeriodFigures(input: {
  siteId: string;
  companyId: string;
  year: number;
  headcount: number | null;
  hoursWorked: number | null;
  actorUserId: string | null;
}): Promise<void> {
  await prisma.sitePeriodFigures.upsert({
    where: { siteId_year: { siteId: input.siteId, year: input.year } },
    create: {
      siteId: input.siteId,
      year: input.year,
      headcount: input.headcount,
      hoursWorked: input.hoursWorked,
      setByUserId: input.actorUserId,
    },
    update: {
      headcount: input.headcount,
      hoursWorked: input.hoursWorked,
      setByUserId: input.actorUserId,
    },
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "site_period_figures.set",
    entityType: "SitePeriodFigures",
    companyId: input.companyId,
    siteId: input.siteId,
    diff: {
      year: input.year,
      headcount: input.headcount,
      hoursWorked: input.hoursWorked,
    },
  });
}
