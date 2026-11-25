// P17 §4 (SLD_P17_TENANT_ROLES_APPROVED.md): which training sessions a viewer
// may see. Pure — the caller resolves the org-unit scope (scope.ts's
// accessibleOrgUnitIds, which is null for a company/site-wide role and a set
// for a leader) and the session's shape from the DB.
//
// Extracted during slice 8's walkthrough: the sessions list had this rule
// inline while the Unterweisungsnachweis PDF route used canAccessCompany, so
// the leader who had just recorded the attendance could not download the proof
// of it (404). One rule, three call sites.

export type SessionVisibilityInput = {
  plannedByUserId: string | null;
  // The home org unit of each participant (null when the person has none).
  participantOrgUnitIds: readonly (string | null)[];
};

export function isSessionVisible(
  session: SessionVisibilityInput,
  accessibleOrgUnits: ReadonlySet<string> | null,
  viewerUserId: string,
): boolean {
  // null = company/site-wide scope: every session of the company.
  if (accessibleOrgUnits === null) return true;
  if (session.plannedByUserId === viewerUserId) return true;
  return session.participantOrgUnitIds.some(
    (id) => id !== null && accessibleOrgUnits.has(id),
  );
}
