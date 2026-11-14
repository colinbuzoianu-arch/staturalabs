import "server-only";

import { cookies } from "next/headers";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { scopedCookieName } from "@/lib/config/base-path";

// P13 §2.4 read-only impersonation. A super_admin can view a tenant's dashboard
// "as" one of its company_admins, for support. The target id is held in an
// HTTP-only cookie; getCurrentPlatformUser honours it ONLY when the real signed-
// in user is a super_admin (so setting the cookie by hand gains a non-super
// nothing). Writes are blocked globally while the cookie is present (middleware
// 403s mutating methods) — read-only in v1. Start/stop are audited; the shell
// shows a persistent banner.

export const IMPERSONATION_COOKIE = scopedCookieName("sld-impersonate");

export async function getImpersonationTargetId(): Promise<string | null> {
  const store = await cookies();
  return store.get(IMPERSONATION_COOKIE)?.value ?? null;
}

export async function startImpersonation(input: {
  targetUserId: string;
  actorUserId: string;
  companyId: string | null;
}): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, input.targetUserId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Session cookie (no maxAge) — ends when the browser closes, a sensible
    // default for a support session.
  });
  await recordAuditEvent({
    actorUserId: input.actorUserId,
    action: "impersonation.start",
    entityType: "PlatformUser",
    entityId: input.targetUserId,
    companyId: input.companyId,
  });
}

export async function stopImpersonation(
  actorUserId: string | null,
): Promise<void> {
  const store = await cookies();
  const target = store.get(IMPERSONATION_COOKIE)?.value ?? null;
  store.delete(IMPERSONATION_COOKIE);
  if (target) {
    await recordAuditEvent({
      actorUserId,
      action: "impersonation.stop",
      entityType: "PlatformUser",
      entityId: target,
    });
  }
}
