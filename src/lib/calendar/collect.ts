import "server-only";

import type { CountryCode } from "@/generated/prisma/enums";
import { lookupIncidentNotificationRules } from "@/lib/incidents/notification-catalog";
import { resolveNotificationDeadline } from "@/lib/incidents/notification-deadline";
import { prisma } from "@/lib/prisma";
import { isReviewDue } from "@/lib/risk/review-cycle";
import type { CalendarEntry, CalendarModule } from "./bucket";

// Re-export the pure types/bucketing so consumers can import everything from
// one place (the pure core lives in ./bucket for direct unit-testing).
export type {
  CalendarBucketKey,
  CalendarEntry,
  CalendarModule,
} from "./bucket";
export { bucketCalendarEntries } from "./bucket";

// P14 G2: the Aktivitätenkalender data source — a READ-ONLY aggregation over the
// due-dated items that already live in the system (no new source of truth, plan
// §G2). Every entry carries a real due date, a deep link to its record, and the
// module it came from so the calendar can filter by module. Person-free: the
// entries are about conditions and records, never a worker — training/people
// due items (people compartment, §3.18) are deliberately NOT surfaced in this
// cross-module overview; they live in the training module behind its own
// permission. SDS review (derived, substance-scoped) is likewise deferred.
//
// Each source is gated by the caller's module permission set, so a user only
// ever sees entries for modules they may read. Scope (which sites) is resolved
// upstream (getAccessibleSites), so this only ever receives sites the user can
// see.

export async function collectCalendarEntries(opts: {
  siteIds: string[];
  modules: ReadonlySet<CalendarModule>;
  now?: Date;
}): Promise<CalendarEntry[]> {
  const { siteIds, modules } = opts;
  const now = opts.now ?? new Date();
  if (siteIds.length === 0) return [];
  const inSites = { in: siteIds };
  const entries: CalendarEntry[] = [];
  const past = (d: Date) => d < now;

  // --- Actions: open/overdue with a due date, + IMPLEMENTED awaiting verification.
  if (modules.has("actions")) {
    const actions = await prisma.action.findMany({
      where: {
        siteId: inSites,
        status: { in: ["OPEN", "IN_PROGRESS", "IMPLEMENTED"] },
      },
      select: {
        id: true,
        siteId: true,
        title: true,
        dueDate: true,
        status: true,
        responsibleUserId: true,
      },
    });
    for (const a of actions) {
      if (a.status === "IMPLEMENTED") {
        // Verification due: no explicit date, so it is "due now" (overdue once
        // past the due date, else today).
        if (!a.dueDate) continue;
        entries.push({
          id: `action-verify-${a.id}`,
          module: "actions",
          kind: "action-verification",
          title: a.title,
          siteId: a.siteId,
          dueDate: a.dueDate,
          overdue: past(a.dueDate),
          href: `/app/s/${a.siteId}/actions/${a.id}`,
          responsibleUserId: a.responsibleUserId,
        });
        continue;
      }
      if (!a.dueDate) continue;
      entries.push({
        id: `action-${a.id}`,
        module: "actions",
        kind: "action-due",
        title: a.title,
        siteId: a.siteId,
        dueDate: a.dueDate,
        overdue: past(a.dueDate),
        href: `/app/s/${a.siteId}/actions/${a.id}`,
        responsibleUserId: a.responsibleUserId,
      });
    }
  }

  // --- Inspections: planned/in-progress with a planned date.
  if (modules.has("inspections")) {
    const inspections = await prisma.inspection.findMany({
      where: {
        siteId: inSites,
        status: { in: ["PLANNED", "IN_PROGRESS"] },
        plannedDate: { not: null },
      },
      select: {
        id: true,
        siteId: true,
        title: true,
        plannedDate: true,
        performedByUserId: true,
      },
    });
    for (const i of inspections) {
      if (!i.plannedDate) continue;
      entries.push({
        id: `inspection-${i.id}`,
        module: "inspections",
        kind: "inspection-planned",
        title: i.title,
        siteId: i.siteId,
        dueDate: i.plannedDate,
        overdue: past(i.plannedDate),
        href: `/app/s/${i.siteId}/inspections/${i.id}`,
        responsibleUserId: i.performedByUserId,
      });
    }
  }

  // --- Assessment reviews: APPROVED assessments whose review is due (P6).
  if (modules.has("risk")) {
    const assessments = await prisma.riskAssessment.findMany({
      where: {
        siteId: inSites,
        status: "APPROVED",
        nextReviewDate: { not: null },
      },
      select: {
        id: true,
        siteId: true,
        nextReviewDate: true,
        reviewRequired: true,
        assessorUserId: true,
        workstation: { select: { name: true } },
        process: { select: { name: true } },
      },
    });
    for (const ra of assessments) {
      if (!ra.nextReviewDate) continue;
      if (!isReviewDue(ra.nextReviewDate, ra.reviewRequired, now)) continue;
      entries.push({
        id: `assessment-${ra.id}`,
        module: "risk",
        kind: "assessment-review",
        title: ra.workstation?.name ?? ra.process?.name ?? "",
        siteId: ra.siteId,
        dueDate: ra.nextReviewDate,
        overdue: past(ra.nextReviewDate),
        href: `/app/s/${ra.siteId}/risk/assessments/${ra.id}`,
        responsibleUserId: ra.assessorUserId,
      });
    }
  }

  // --- Legal reviews: compliance evaluations with a next-review date (P11).
  if (modules.has("legal")) {
    const evals = await prisma.complianceEvaluation.findMany({
      where: {
        nextReviewDue: { not: null },
        siteLegalRequirement: { siteId: inSites },
      },
      select: {
        id: true,
        nextReviewDue: true,
        siteLegalRequirement: {
          select: {
            siteId: true,
            legalRequirement: { select: { obligationSummary: true } },
          },
        },
      },
    });
    for (const ev of evals) {
      if (!ev.nextReviewDue) continue;
      const siteId = ev.siteLegalRequirement.siteId;
      entries.push({
        id: `legal-${ev.id}`,
        module: "legal",
        kind: "legal-review",
        title: ev.siteLegalRequirement.legalRequirement.obligationSummary,
        siteId,
        dueDate: ev.nextReviewDue,
        overdue: past(ev.nextReviewDue),
        href: `/app/s/${siteId}/legal/register`,
        responsibleUserId: null,
      });
    }
  }

  // --- Incident notification deadlines: a recent incident whose statutory
  // notification has NOT yet been submitted/waived (no StatutoryNotification row,
  // or still REQUIRED), with the deadline resolved LIVE from the per-country rule
  // catalogue (no persisted duty; no cross-country borrow, §3.15 — only the
  // "deadline" kind carries a date, so immediate/asSoonAsPossible/none are not
  // calendar entries). Bounded to the last 180 days so a long-closed historical
  // case never lingers as a permanently-overdue row — the notification window is
  // days, not months.
  if (modules.has("incidents")) {
    const horizon = new Date(now.getTime());
    horizon.setUTCDate(horizon.getUTCDate() - 180);
    const incidents = await prisma.incident.findMany({
      where: {
        siteId: inSites,
        reportedAt: { gte: horizon },
        OR: [
          { statutoryNotification: { is: null } },
          { statutoryNotification: { status: "REQUIRED" } },
        ],
      },
      select: {
        id: true,
        siteId: true,
        title: true,
        type: true,
        reportedAt: true,
        site: { select: { country: true } },
      },
    });
    if (incidents.length > 0) {
      const countries = [...new Set(incidents.map((i) => i.site.country))];
      const rulesByCountry = new Map<
        CountryCode,
        Awaited<ReturnType<typeof lookupIncidentNotificationRules>>
      >();
      await Promise.all(
        countries.map(async (c) => {
          rulesByCountry.set(c, await lookupIncidentNotificationRules(c));
        }),
      );
      for (const inc of incidents) {
        const rules = rulesByCountry.get(inc.site.country) ?? [];
        const duty = resolveNotificationDeadline(
          rules,
          inc.type,
          inc.reportedAt,
        );
        if (duty.kind !== "deadline") continue;
        entries.push({
          id: `incident-${inc.id}`,
          module: "incidents",
          kind: "incident-notification",
          title: inc.title,
          siteId: inc.siteId,
          dueDate: duty.dueAt,
          overdue: past(duty.dueAt),
          href: `/app/s/${inc.siteId}/incidents/${inc.id}`,
          responsibleUserId: null,
        });
      }
    }
  }

  entries.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return entries;
}
