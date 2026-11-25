import "server-only";

import type { PlatformUserModel } from "@/generated/prisma/models";
import { withMinimumGroupSize } from "@/lib/analytics/min-group-size";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { accessibleOrgUnitIds, selfPersonId } from "@/lib/auth/scope";
import { prisma } from "@/lib/prisma";

// The sender's status view, the leader's team view, and the works council's
// aggregate view — one resolver, three audiences, with the P17 §2 visibility
// rules applied HERE rather than in each page.
//
// Who may see a PER-PERSON list:
//   * company_admin / site_admin / ehs_specialist → the people in their scope;
//   * manager (leader) → only their own org units;
//   * works_council → NEVER a per-person list. They get the aggregate, and
//     only when the group is big enough (§3.4 minimum group size), reusing the
//     same helper the KPI engine uses so there is one rule, not two.

export type BroadcastTotals = {
  recipients: number;
  delivered: number;
  read: number;
  confirmed: number;
  overdue: number;
};

export type BroadcastBreakdownRow = {
  key: string;
  label: string;
  recipients: number;
  confirmed: number;
  // null = suppressed because the group is smaller than the minimum (works
  // council view only).
  confirmationRate: number | null;
};

export type BroadcastPerson = {
  recipientId: string;
  name: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
  isAccountOnly: boolean;
  deliveredAt: Date | null;
  readAt: Date | null;
  confirmedAt: Date | null;
};

export type BroadcastStatusView = {
  totals: BroadcastTotals;
  bySite: BroadcastBreakdownRow[];
  byOrgUnit: BroadcastBreakdownRow[];
  // Empty when the viewer may not see individuals (works council), or scoped
  // to their own units (leader).
  persons: BroadcastPerson[];
  personsSuppressed: boolean;
};

function rate(confirmed: number, recipients: number): number | null {
  if (recipients === 0) return null;
  return Math.round((confirmed / recipients) * 1000) / 10;
}

// §3.4: for a works-council viewer a rate over a group smaller than the
// minimum is suppressed (null), using the SAME helper the KPI engine uses —
// one rule for "never let an aggregate single someone out", not two.
function scopedRate(
  confirmed: number,
  recipients: number,
  suppressSmallGroups: boolean,
): number | null {
  const value = rate(confirmed, recipients);
  if (value === null) return null;
  if (!suppressSmallGroups) return value;
  const stat = withMinimumGroupSize(value, recipients);
  return stat.suppressed ? null : stat.value;
}

export async function getBroadcastStatus(input: {
  broadcastId: string;
  viewer: PlatformUserModel;
  now?: Date;
}): Promise<BroadcastStatusView> {
  const now = input.now ?? new Date();
  const broadcast = await prisma.broadcast.findUniqueOrThrow({
    where: { id: input.broadcastId },
    select: {
      id: true,
      companyId: true,
      siteId: true,
      requiresConfirmation: true,
      confirmationDueAt: true,
    },
  });

  const recipients = await prisma.broadcastRecipient.findMany({
    where: { broadcastId: broadcast.id },
    select: {
      id: true,
      platformUserId: true,
      personId: true,
      deliveredAt: true,
      readAt: true,
      confirmedAt: true,
    },
  });

  const overdueNow =
    broadcast.requiresConfirmation &&
    broadcast.confirmationDueAt !== null &&
    broadcast.confirmationDueAt.getTime() < now.getTime();

  const totals: BroadcastTotals = {
    recipients: recipients.length,
    delivered: recipients.filter((r) => r.deliveredAt !== null).length,
    read: recipients.filter((r) => r.readAt !== null).length,
    confirmed: recipients.filter((r) => r.confirmedAt !== null).length,
    overdue: overdueNow
      ? recipients.filter((r) => r.confirmedAt === null).length
      : 0,
  };

  // Resolve names + org units for the person rows, and the site each person
  // belongs to, from the people compartment only.
  const personIds = recipients
    .map((r) => r.personId)
    .filter((id): id is string => id !== null);
  const accountIds = recipients
    .map((r) => r.platformUserId)
    .filter((id): id is string => id !== null);

  const [persons, accounts, orgUnits] = await Promise.all([
    personIds.length > 0
      ? prisma.person.findMany({
          where: { id: { in: personIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            orgUnitId: true,
            anonymisedAt: true,
          },
        })
      : Promise.resolve([]),
    accountIds.length > 0
      ? prisma.platformUser.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.orgUnit.findMany({
      where: { site: { companyId: broadcast.companyId } },
      select: { id: true, name: true, siteId: true },
    }),
  ]);
  const personById = new Map(persons.map((p) => [p.id, p]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const orgUnitById = new Map(orgUnits.map((o) => [o.id, o]));

  const viewerIsWorksCouncil = input.viewer.role === "WORKS_COUNCIL";
  const viewerUnits = await accessibleOrgUnitIds(input.viewer);

  const allPersonRows: BroadcastPerson[] = recipients.map((r) => {
    const person = r.personId ? personById.get(r.personId) : undefined;
    const account = r.platformUserId
      ? accountById.get(r.platformUserId)
      : undefined;
    const unit = person?.orgUnitId
      ? orgUnitById.get(person.orgUnitId)
      : undefined;
    return {
      recipientId: r.id,
      name: person
        ? person.anonymisedAt
          ? "—"
          : `${person.lastName}, ${person.firstName}`
        : (account?.name ?? "—"),
      orgUnitId: person?.orgUnitId ?? null,
      orgUnitName: unit?.name ?? null,
      isAccountOnly: !person,
      deliveredAt: r.deliveredAt,
      readAt: r.readAt,
      confirmedAt: r.confirmedAt,
    };
  });

  // Breakdown by org unit (the "per site and org unit" view). Recipients with
  // no unit (account-only, e.g. a role audience) are grouped separately rather
  // than hidden.
  const byUnit = new Map<string, { recipients: number; confirmed: number }>();
  for (const row of allPersonRows) {
    const key = row.orgUnitId ?? "__none__";
    const current = byUnit.get(key) ?? { recipients: 0, confirmed: 0 };
    current.recipients += 1;
    if (row.confirmedAt) current.confirmed += 1;
    byUnit.set(key, current);
  }
  const byOrgUnit: BroadcastBreakdownRow[] = [...byUnit.entries()].map(
    ([key, v]) => ({
      key,
      label: key === "__none__" ? "—" : (orgUnitById.get(key)?.name ?? key),
      recipients: v.recipients,
      confirmed: v.confirmed,
      // §3.4: a works-council viewer never sees a rate computed over a group
      // small enough to single someone out.
      confirmationRate: scopedRate(
        v.confirmed,
        v.recipients,
        viewerIsWorksCouncil,
      ),
    }),
  );

  const bySiteMap = new Map<
    string,
    { recipients: number; confirmed: number }
  >();
  for (const row of allPersonRows) {
    const unit = row.orgUnitId ? orgUnitById.get(row.orgUnitId) : undefined;
    const key = unit?.siteId ?? broadcast.siteId ?? "__company__";
    const current = bySiteMap.get(key) ?? { recipients: 0, confirmed: 0 };
    current.recipients += 1;
    if (row.confirmedAt) current.confirmed += 1;
    bySiteMap.set(key, current);
  }
  const siteNames = await prisma.site.findMany({
    where: { companyId: broadcast.companyId },
    select: { id: true, name: true },
  });
  const siteNameById = new Map(siteNames.map((s) => [s.id, s.name]));
  const bySite: BroadcastBreakdownRow[] = [...bySiteMap.entries()].map(
    ([key, v]) => ({
      key,
      label: siteNameById.get(key) ?? "—",
      recipients: v.recipients,
      confirmed: v.confirmed,
      confirmationRate: scopedRate(
        v.confirmed,
        v.recipients,
        viewerIsWorksCouncil,
      ),
    }),
  );

  // The per-person list, scoped to what this viewer may see.
  let visiblePersons: BroadcastPerson[] = [];
  if (!viewerIsWorksCouncil) {
    visiblePersons =
      viewerUnits === null
        ? allPersonRows
        : allPersonRows.filter(
            (r) => r.orgUnitId !== null && viewerUnits.has(r.orgUnitId),
          );
  }

  return {
    totals,
    bySite,
    byOrgUnit,
    persons: visiblePersons,
    personsSuppressed: viewerIsWorksCouncil,
  };
}

// The recipient's own confirmation. Idempotent (a second click changes
// nothing), append-only in spirit — confirmedAt is set once and never cleared,
// because "I read and understood this" is a statement, not a toggle.
export async function confirmBroadcast(input: {
  user: PlatformUserModel;
  broadcastId: string;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = input.now ?? new Date();
  const personId = await selfPersonId(input.user);
  const recipient = await prisma.broadcastRecipient.findFirst({
    where: {
      broadcastId: input.broadcastId,
      OR: [
        { platformUserId: input.user.id },
        ...(personId ? [{ personId }] : []),
      ],
    },
    select: { id: true, confirmedAt: true },
  });
  // Not addressed → nothing to confirm. Fail-closed, and deliberately the same
  // answer as "already confirmed" from the caller's point of view.
  if (!recipient) return { ok: false, reason: "not-a-recipient" };
  if (recipient.confirmedAt) return { ok: false, reason: "already-confirmed" };

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: input.broadcastId },
    select: {
      status: true,
      companyId: true,
      siteId: true,
      requiresConfirmation: true,
    },
  });
  if (!broadcast) return { ok: false, reason: "not-found" };
  // A draft has no recipients and an archived message is history: neither is
  // something to newly confirm.
  if (broadcast.status !== "PUBLISHED") {
    return { ok: false, reason: "not-published" };
  }
  if (!broadcast.requiresConfirmation) {
    return { ok: false, reason: "confirmation-not-required" };
  }

  await prisma.broadcastRecipient.update({
    where: { id: recipient.id },
    // Reading is implied by confirming; stamp it if the row somehow has none.
    data: { confirmedAt: now, readAt: { set: now } },
  });
  await recordAuditEvent({
    actorUserId: input.user.id,
    action: "broadcast.confirm",
    entityType: "Broadcast",
    entityId: input.broadcastId,
    companyId: broadcast.companyId,
    siteId: broadcast.siteId,
  });
  return { ok: true };
}
