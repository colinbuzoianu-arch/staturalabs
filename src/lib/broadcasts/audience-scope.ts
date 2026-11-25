import type {
  BroadcastAudienceScope,
  PlatformRole,
} from "@/generated/prisma/enums";

// Who may address whom (the prompt's "WHO CAN SEND", layered on the P17 §2
// matrix). Pure: the caller resolves the sender's real scope from the DB
// (src/lib/auth/scope.ts) and hands it here, so every in/out-of-scope case is
// unit-testable without a database.
//
// The rule is "never outside your own scope", enforced here and NOT in the UI:
//   company_admin  → any audience in the company.
//   site_admin     → audiences within their own sites.
//   ehs_specialist → audiences within their own sites.
//   manager        → only their own org units (incl. sub-units) and the
//                    workstations in them. SAFETY_ALERT is allowed for those.
//   employee       → cannot send at all.
// works_council and occupational_physician are not senders either; the works
// council's read surface (archived broadcasts + aggregate rates) is separate.

export type SenderScope = {
  role: PlatformRole;
  companyId: string | null;
  // Sites the sender may act on (company_admin: every site of the company).
  siteIds: ReadonlySet<string>;
  // Org units the sender may act on, already expanded to sub-units. `null`
  // means "no org-unit restriction" (company/site-wide roles).
  orgUnitIds: ReadonlySet<string> | null;
};

export type AudienceTarget = {
  scope: BroadcastAudienceScope;
  siteId?: string | null;
  orgUnitId?: string | null;
  workstationId?: string | null;
  role?: PlatformRole | null;
  // For ORG_UNIT / WORKSTATION targets the caller resolves which site and (for
  // a workstation) which org unit the target actually belongs to, so this
  // function never has to guess — and a target in another tenant simply has no
  // resolved site and is refused.
  resolvedSiteId?: string | null;
  resolvedOrgUnitId?: string | null;
};

export type AudienceScopeCheck =
  | { ok: true }
  | { ok: false; reason: AudienceScopeRefusal };

export type AudienceScopeRefusal =
  | "role-cannot-send"
  | "outside-company"
  | "outside-sites"
  | "outside-org-units"
  | "target-unresolved"
  | "company-wide-not-allowed"
  | "role-audience-not-allowed";

const SENDER_ROLES: readonly PlatformRole[] = [
  "COMPANY_ADMIN",
  "SITE_ADMIN",
  "EHS_SPECIALIST",
  "MANAGER",
];

export function canRoleSendBroadcasts(role: PlatformRole): boolean {
  return SENDER_ROLES.includes(role);
}

// Only a company-wide role may address the whole company, and only
// company/site-wide roles may address "every holder of role X" — a leader's
// audience is their units, not a role list they cannot see.
function isCompanyWide(scope: SenderScope): boolean {
  return scope.orgUnitIds === null && scope.role === "COMPANY_ADMIN";
}

export function validateAudienceTarget(
  sender: SenderScope,
  target: AudienceTarget,
): AudienceScopeCheck {
  if (!canRoleSendBroadcasts(sender.role)) {
    return { ok: false, reason: "role-cannot-send" };
  }

  switch (target.scope) {
    case "COMPANY": {
      if (!isCompanyWide(sender)) {
        return { ok: false, reason: "company-wide-not-allowed" };
      }
      return { ok: true };
    }
    case "SITE": {
      const siteId = target.siteId ?? null;
      if (!siteId) return { ok: false, reason: "target-unresolved" };
      if (!sender.siteIds.has(siteId)) {
        return { ok: false, reason: "outside-sites" };
      }
      // A leader has no whole-site audience: their scope is units.
      if (sender.orgUnitIds !== null) {
        return { ok: false, reason: "outside-org-units" };
      }
      return { ok: true };
    }
    case "ORG_UNIT": {
      const orgUnitId = target.orgUnitId ?? null;
      if (!orgUnitId) return { ok: false, reason: "target-unresolved" };
      const siteId = target.resolvedSiteId ?? null;
      if (!siteId) return { ok: false, reason: "target-unresolved" };
      if (!sender.siteIds.has(siteId)) {
        return { ok: false, reason: "outside-sites" };
      }
      if (sender.orgUnitIds !== null && !sender.orgUnitIds.has(orgUnitId)) {
        return { ok: false, reason: "outside-org-units" };
      }
      return { ok: true };
    }
    case "WORKSTATION": {
      const workstationId = target.workstationId ?? null;
      if (!workstationId) return { ok: false, reason: "target-unresolved" };
      const siteId = target.resolvedSiteId ?? null;
      if (!siteId) return { ok: false, reason: "target-unresolved" };
      if (!sender.siteIds.has(siteId)) {
        return { ok: false, reason: "outside-sites" };
      }
      if (sender.orgUnitIds !== null) {
        const unit = target.resolvedOrgUnitId ?? null;
        // A workstation with no org unit cannot be shown to be inside a
        // leader's units — refuse rather than assume.
        if (!unit || !sender.orgUnitIds.has(unit)) {
          return { ok: false, reason: "outside-org-units" };
        }
      }
      return { ok: true };
    }
    case "ROLE": {
      if (!target.role) return { ok: false, reason: "target-unresolved" };
      if (sender.orgUnitIds !== null) {
        return { ok: false, reason: "role-audience-not-allowed" };
      }
      // Site-scoped senders may address a role, but only within a site they
      // hold — the site comes from the broadcast itself, checked by the gate.
      return { ok: true };
    }
    default: {
      // Unknown scope value (hand-edited row) → refuse, fail-closed.
      return { ok: false, reason: "target-unresolved" };
    }
  }
}

// Every target must pass; the first refusal is returned. An empty list is a
// refusal too — a broadcast with no audience must never reach publishing.
export function validateAudienceTargets(
  sender: SenderScope,
  targets: readonly AudienceTarget[],
): AudienceScopeCheck {
  if (targets.length === 0) return { ok: false, reason: "target-unresolved" };
  for (const target of targets) {
    const result = validateAudienceTarget(sender, target);
    if (!result.ok) return result;
  }
  return { ok: true };
}
