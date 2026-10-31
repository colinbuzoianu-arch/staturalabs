import { createHash } from "node:crypto";
import type { AuditEventModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// The one global audit-log write helper (SLD_RESTRUCTURE_PLAN_platform-modules.md
// §2.2 rule 9, ERGO_COMPLIANCE_BY_DESIGN.md §3.18(d)). Every mutation in a
// regulated module (incidents, people, training proof, approvals) and every
// read of the health sub-compartment goes through here — one call site shape,
// one table, append-only.
//
// No `import "server-only"`: unit-tested with a mocked prisma, same reasoning
// as the other lib gates. (It does use node:crypto, so it is Node-runtime
// only in practice — which every regulated-module mutation already is.)
//
// Append-only by contract: there is intentionally no update or delete helper,
// and the log OUTLIVES the entity it describes (the schema stores
// companyId/siteId/entityId/actorUserId as plain columns, not FKs), so the
// record of a deletion survives the deletion.

export type AuditEventInput = {
  // PlatformUser account id (§3.1/§3.13), never a shop-floor worker. Null for
  // a system/automated action or an anonymous (QR-link) report.
  actorUserId?: string | null;
  // A stable verb.noun, e.g. "incident.create", "action.verify",
  // "health_data.read", "risk_assessment.approve". Free text by design — the
  // regulated modules each own their verbs; this helper does not enumerate them.
  action: string;
  // The entity touched, e.g. "Incident", and its id (id nullable for a
  // create where the id is assigned after, or a non-entity event).
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  siteId?: string | null;
  // Before/after of REGULATED FIELDS only — never raw health free-text, which
  // stays in the encrypted health sub-compartment and is referenced, not copied.
  diff?: unknown;
  // Raw client IP; it is HASHED here and never stored in the clear.
  ip?: string | null;
};

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export async function recordAuditEvent(
  input: AuditEventInput,
): Promise<AuditEventModel> {
  return prisma.auditEvent.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      companyId: input.companyId ?? null,
      siteId: input.siteId ?? null,
      diff: input.diff === undefined ? undefined : (input.diff as never),
      ipHash: hashIp(input.ip),
    },
  });
}
