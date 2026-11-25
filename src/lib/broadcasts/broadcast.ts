import type {
  BroadcastAudienceScope,
  BroadcastDomain,
  BroadcastPriority,
  BroadcastStatus,
  PlatformRole,
} from "@/generated/prisma/enums";
import type {
  BroadcastModel,
  PlatformUserModel,
} from "@/generated/prisma/models";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { prisma } from "@/lib/prisma";
import {
  type AudienceTarget,
  canRoleSendBroadcasts,
  type SenderScope,
  validateAudienceTargets,
} from "./audience-scope";
import { sanitiseBroadcastBody } from "./sanitise";
import {
  validateBroadcastPublishable,
  validateBroadcastTransition,
} from "./transitions";

// Sicherheitsinformationen write gates — one function per rule, same shape as
// every other lib gate here (createAssessmentSession, transitionAction,
// createIncident). Every mutation records an AuditEvent.
//
// No `import "server-only"`: directly unit-testable with a mocked prisma, like
// the other gates. The pages gate the CALLER (module permission + site scope);
// these functions own the invariants.

export class BroadcastGateError extends Error {}

export type AudienceInput = {
  scope: BroadcastAudienceScope;
  siteId?: string | null;
  orgUnitId?: string | null;
  workstationId?: string | null;
  role?: PlatformRole | null;
};

// Resolve the sender's real scope from their role + assignments. ONE place, so
// the compose form, the publish gate and the status view can never disagree
// about what a sender may address.
export async function resolveSenderScope(
  user: PlatformUserModel,
): Promise<SenderScope> {
  const { accessibleOrgUnitIds } = await import("@/lib/auth/scope");
  const { getAccessibleSites } = await import("@/lib/auth/accessible-sites");
  const sites = await getAccessibleSites(user);
  const orgUnitIds = await accessibleOrgUnitIds(user);
  return {
    role: user.role,
    companyId: user.companyId,
    siteIds: new Set(sites.map((s) => s.id)),
    orgUnitIds,
  };
}

// Turn the submitted audience rows into the fully-resolved targets the pure
// scope check needs: for an org unit / workstation we look up which site (and
// for a workstation which org unit) it actually belongs to. A target in
// another tenant resolves to nothing and is therefore refused.
async function resolveTargets(
  companyId: string,
  audiences: readonly AudienceInput[],
): Promise<AudienceTarget[]> {
  const orgUnitIds = audiences
    .map((a) => a.orgUnitId)
    .filter((id): id is string => !!id);
  const workstationIds = audiences
    .map((a) => a.workstationId)
    .filter((id): id is string => !!id);

  const [orgUnits, workstations] = await Promise.all([
    orgUnitIds.length > 0
      ? prisma.orgUnit.findMany({
          where: { id: { in: orgUnitIds }, site: { companyId } },
          select: { id: true, siteId: true },
        })
      : Promise.resolve([]),
    workstationIds.length > 0
      ? prisma.workstation.findMany({
          where: { id: { in: workstationIds }, site: { companyId } },
          select: { id: true, siteId: true, orgUnitId: true },
        })
      : Promise.resolve([]),
  ]);
  const orgUnitSite = new Map(orgUnits.map((o) => [o.id, o.siteId]));
  const workstationById = new Map(workstations.map((w) => [w.id, w]));

  return audiences.map((a) => {
    if (a.scope === "ORG_UNIT") {
      return {
        ...a,
        resolvedSiteId: a.orgUnitId
          ? (orgUnitSite.get(a.orgUnitId) ?? null)
          : null,
      };
    }
    if (a.scope === "WORKSTATION") {
      const ws = a.workstationId
        ? workstationById.get(a.workstationId)
        : undefined;
      return {
        ...a,
        resolvedSiteId: ws?.siteId ?? null,
        resolvedOrgUnitId: ws?.orgUnitId ?? null,
      };
    }
    return { ...a };
  });
}

// The one audience guard. Exported so the compose surface can pre-check before
// it ever writes, and the publish path can re-check (a scope may have been
// revoked between composing and publishing).
export async function assertAudienceWithinSenderScope(input: {
  user: PlatformUserModel;
  companyId: string;
  siteId: string | null;
  audiences: readonly AudienceInput[];
}): Promise<void> {
  if (!input.user.companyId || input.user.companyId !== input.companyId) {
    throw new BroadcastGateError("outside-company");
  }
  const sender = await resolveSenderScope(input.user);
  // A site-scoped broadcast must itself be on a site the sender holds.
  if (input.siteId && !sender.siteIds.has(input.siteId)) {
    throw new BroadcastGateError("outside-sites");
  }
  // A ROLE audience is resolved within the broadcast's site, so a site-scoped
  // sender addressing a role needs the broadcast to name one of their sites.
  if (
    input.audiences.some((a) => a.scope === "ROLE") &&
    !input.siteId &&
    sender.role !== "COMPANY_ADMIN"
  ) {
    throw new BroadcastGateError("role-audience-not-allowed");
  }
  const targets = await resolveTargets(input.companyId, input.audiences);
  const result = validateAudienceTargets(sender, targets);
  if (!result.ok) throw new BroadcastGateError(result.reason);
}

export type CreateBroadcastInput = {
  user: PlatformUserModel;
  companyId: string;
  siteId: string | null;
  title: string;
  body: string;
  priority: BroadcastPriority;
  domain: BroadcastDomain;
  documentId?: string | null;
  incidentId?: string | null;
  operatingInstructionId?: string | null;
  actionId?: string | null;
  requiresConfirmation: boolean;
  confirmationDueAt?: Date | null;
  audiences: readonly AudienceInput[];
};

// Create a DRAFT with its audience rows in one transaction. The body is
// sanitised here, at the only place that writes it.
export async function createBroadcast(
  input: CreateBroadcastInput,
): Promise<BroadcastModel> {
  if (!canRoleSendBroadcasts(input.user.role)) {
    throw new BroadcastGateError("role-cannot-send");
  }
  if (input.title.trim().length === 0) {
    throw new BroadcastGateError("title-required");
  }
  if (input.body.trim().length === 0) {
    throw new BroadcastGateError("body-required");
  }
  const linkCount = [
    input.documentId,
    input.incidentId,
    input.operatingInstructionId,
    input.actionId,
  ].filter((v) => !!v).length;
  if (linkCount > 1) {
    throw new BroadcastGateError("at-most-one-link");
  }
  if (!input.requiresConfirmation && input.confirmationDueAt) {
    throw new BroadcastGateError("due-without-confirmation");
  }
  await assertAudienceWithinSenderScope({
    user: input.user,
    companyId: input.companyId,
    siteId: input.siteId,
    audiences: input.audiences,
  });
  await assertLinksWithinCompany(input);

  const body = sanitiseBroadcastBody(input.body);
  const broadcast = await prisma.$transaction(async (tx) => {
    const created = await tx.broadcast.create({
      data: {
        companyId: input.companyId,
        siteId: input.siteId,
        title: input.title.trim(),
        body,
        priority: input.priority,
        domain: input.domain,
        status: "DRAFT",
        documentId: input.documentId ?? null,
        incidentId: input.incidentId ?? null,
        operatingInstructionId: input.operatingInstructionId ?? null,
        actionId: input.actionId ?? null,
        requiresConfirmation: input.requiresConfirmation,
        confirmationDueAt: input.confirmationDueAt ?? null,
        createdByUserId: input.user.id,
      },
    });
    for (const audience of input.audiences) {
      await tx.broadcastAudience.create({
        data: {
          broadcastId: created.id,
          scope: audience.scope,
          siteId: audience.siteId ?? null,
          orgUnitId: audience.orgUnitId ?? null,
          workstationId: audience.workstationId ?? null,
          role: audience.role ?? null,
        },
      });
    }
    await tx.broadcastStatusEvent.create({
      data: {
        broadcastId: created.id,
        fromStatus: null,
        toStatus: "DRAFT",
        actorUserId: input.user.id,
      },
    });
    return created;
  });

  await recordAuditEvent({
    actorUserId: input.user.id,
    action: "broadcast.create",
    entityType: "Broadcast",
    entityId: broadcast.id,
    companyId: input.companyId,
    siteId: input.siteId,
    diff: {
      priority: input.priority,
      domain: input.domain,
      requiresConfirmation: input.requiresConfirmation,
      audiences: input.audiences.map((a) => a.scope),
    },
  });
  return broadcast;
}

// Every content link must belong to the same company — a link is a pointer a
// recipient may follow, so a cross-tenant one would be a leak, not a typo.
async function assertLinksWithinCompany(input: {
  companyId: string;
  documentId?: string | null;
  incidentId?: string | null;
  operatingInstructionId?: string | null;
  actionId?: string | null;
}): Promise<void> {
  if (input.documentId) {
    const row = await prisma.document.findUnique({
      where: { id: input.documentId },
      select: { companyId: true },
    });
    if (row?.companyId !== input.companyId) {
      throw new BroadcastGateError("link-outside-company");
    }
  }
  if (input.incidentId) {
    const row = await prisma.incident.findUnique({
      where: { id: input.incidentId },
      select: { companyId: true },
    });
    if (row?.companyId !== input.companyId) {
      throw new BroadcastGateError("link-outside-company");
    }
  }
  if (input.operatingInstructionId) {
    const row = await prisma.operatingInstruction.findUnique({
      where: { id: input.operatingInstructionId },
      select: { site: { select: { companyId: true } } },
    });
    if (row?.site.companyId !== input.companyId) {
      throw new BroadcastGateError("link-outside-company");
    }
  }
  if (input.actionId) {
    const row = await prisma.action.findUnique({
      where: { id: input.actionId },
      select: { site: { select: { companyId: true } } },
    });
    if (row?.site.companyId !== input.companyId) {
      throw new BroadcastGateError("link-outside-company");
    }
  }
}

export type UpdateBroadcastDraftInput = {
  broadcastId: string;
  user: PlatformUserModel;
  title?: string;
  body?: string;
  priority?: BroadcastPriority;
  domain?: BroadcastDomain;
  requiresConfirmation?: boolean;
  confirmationDueAt?: Date | null;
};

// A DRAFT may be edited; a PUBLISHED message may not. What people were told
// must stay what the record says they were told.
export async function updateBroadcastDraft(
  input: UpdateBroadcastDraftInput,
): Promise<BroadcastModel> {
  const current = await prisma.broadcast.findUnique({
    where: { id: input.broadcastId },
    select: { status: true, companyId: true, siteId: true },
  });
  if (!current) throw new BroadcastGateError("not-found");
  if (current.status !== "DRAFT") {
    throw new BroadcastGateError("only-draft-editable");
  }
  const requiresConfirmation = input.requiresConfirmation;
  const updated = await prisma.broadcast.update({
    where: { id: input.broadcastId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined
        ? { body: sanitiseBroadcastBody(input.body) }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.domain !== undefined ? { domain: input.domain } : {}),
      ...(requiresConfirmation !== undefined
        ? {
            requiresConfirmation,
            // Turning confirmation off clears the deadline (the DB CHECK would
            // reject the inconsistent pair anyway — better a clean write than
            // a constraint error).
            ...(requiresConfirmation ? {} : { confirmationDueAt: null }),
          }
        : {}),
      ...(input.confirmationDueAt !== undefined
        ? { confirmationDueAt: input.confirmationDueAt }
        : {}),
    },
  });
  await recordAuditEvent({
    actorUserId: input.user.id,
    action: "broadcast.update_draft",
    entityType: "Broadcast",
    entityId: input.broadcastId,
    companyId: current.companyId,
    siteId: current.siteId,
  });
  return updated;
}

// Status transitions other than publishing (which has its own gate in slice 2
// because it also resolves the recipient snapshot). Writes the append-only
// history row in the same transaction as the status change.
export async function transitionBroadcast(input: {
  broadcastId: string;
  to: BroadcastStatus;
  user: PlatformUserModel;
  note?: string | null;
  now?: Date;
}): Promise<BroadcastModel> {
  const now = input.now ?? new Date();
  const current = await prisma.broadcast.findUnique({
    where: { id: input.broadcastId },
    select: { status: true, companyId: true, siteId: true },
  });
  if (!current) throw new BroadcastGateError("not-found");
  const check = validateBroadcastTransition(current.status, input.to);
  if (!check.ok) throw new BroadcastGateError(check.reason);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.broadcast.update({
      where: { id: input.broadcastId },
      data: {
        status: input.to,
        ...(input.to === "ARCHIVED" ? { archivedAt: now } : {}),
      },
    });
    await tx.broadcastStatusEvent.create({
      data: {
        broadcastId: input.broadcastId,
        fromStatus: current.status,
        toStatus: input.to,
        note: input.note ?? null,
        actorUserId: input.user.id,
      },
    });
    return row;
  });

  await recordAuditEvent({
    actorUserId: input.user.id,
    action: `broadcast.${input.to.toLowerCase()}`,
    entityType: "Broadcast",
    entityId: input.broadcastId,
    companyId: current.companyId,
    siteId: current.siteId,
    diff: { from: current.status, to: input.to },
  });
  return updated;
}

// Publish-readiness, resolved from the DB (the pure rule lives in
// transitions.ts). Exported so the compose screen can show WHY the publish
// button is disabled rather than just disabling it.
export async function checkBroadcastPublishable(
  broadcastId: string,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: {
      status: true,
      title: true,
      body: true,
      requiresConfirmation: true,
      confirmationDueAt: true,
      _count: { select: { audiences: true } },
    },
  });
  if (!broadcast) return { ok: false, reason: "not-found" };
  const transition = validateBroadcastTransition(broadcast.status, "PUBLISHED");
  if (!transition.ok) return transition;
  return validateBroadcastPublishable(
    {
      title: broadcast.title,
      body: broadcast.body,
      audienceCount: broadcast._count.audiences,
      requiresConfirmation: broadcast.requiresConfirmation,
      confirmationDueAt: broadcast.confirmationDueAt,
    },
    now,
  );
}
