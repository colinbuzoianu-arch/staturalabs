import { revalidatePath } from "next/cache";
import type { PlatformRole, ScopeType } from "@/generated/prisma/enums";
import { inviteTenantUser, TenantInviteError } from "@/lib/admin/trial";
import { trialUserLimit } from "@/lib/admin/trial-limits";
import { canAccessCompany } from "@/lib/auth/rbac";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { grantRole, revokeRoleAssignment } from "@/lib/auth/role-assignment";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

const GRANTABLE_ROLES: PlatformRole[] = [
  "COMPANY_ADMIN",
  "SITE_ADMIN",
  "EHS_SPECIALIST",
  "MANAGER",
  "EMPLOYEE",
  "OCCUPATIONAL_PHYSICIAN",
  "WORKS_COUNCIL",
];
const SCOPE_TYPES: ScopeType[] = ["COMPANY", "SITE", "ORG_UNIT", "SELF"];

// P7d §B.3: users & roles provisioning. Company-admin-only grant/revoke of
// RoleAssignment rows at a scope; site_admins see a read-only list. The full
// invite flow (Supabase auth creation + email) and account disable are
// production-auth (P13); this manages roles/scopes for users that exist.
export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { siteId } = await params;
  const { invite } = await searchParams;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).usersPage;
  const companyId = site.companyId;
  const canManage = canAccessCompany(user, companyId);
  const trialDict = getAdministrationDictionary(locale).trial;

  async function grantAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).usersPage;
    if (!canAccessCompany(actor, s.companyId)) {
      throw new Error(d.readOnlyNote);
    }
    const platformUserId = formData.get("platformUserId");
    const roleRaw = formData.get("role");
    const scopeTypeRaw = formData.get("scopeType");
    const targetRaw = formData.get("target");
    if (
      typeof platformUserId !== "string" ||
      !GRANTABLE_ROLES.includes(roleRaw as PlatformRole) ||
      !SCOPE_TYPES.includes(scopeTypeRaw as ScopeType)
    ) {
      throw new Error(d.scopeMismatch);
    }
    const scopeType = scopeTypeRaw as ScopeType;
    const needsTarget = scopeType === "SITE" || scopeType === "ORG_UNIT";
    let scopeId: string | null = null;
    if (needsTarget) {
      // target value is "site:<id>" or "orgunit:<id>"; it must match scopeType.
      const value = typeof targetRaw === "string" ? targetRaw : "";
      const [kind, id] = value.split(":");
      if (
        !id ||
        (scopeType === "SITE" && kind !== "site") ||
        (scopeType === "ORG_UNIT" && kind !== "orgunit")
      ) {
        throw new Error(d.scopeMismatch);
      }
      // Confirm the target belongs to this company.
      if (scopeType === "SITE") {
        const target = await prisma.site.findUnique({
          where: { id },
          select: { companyId: true },
        });
        if (target?.companyId !== s.companyId) throw new Error(d.scopeMismatch);
      } else {
        const target = await prisma.orgUnit.findUnique({
          where: { id },
          select: { site: { select: { companyId: true } } },
        });
        if (target?.site.companyId !== s.companyId) {
          throw new Error(d.scopeMismatch);
        }
      }
      scopeId = id;
    }
    // The target user must belong to this company.
    const targetUser = await prisma.platformUser.findUnique({
      where: { id: platformUserId },
      select: { companyId: true },
    });
    if (targetUser?.companyId !== s.companyId) {
      throw new Error(d.scopeMismatch);
    }
    await grantRole({
      platformUserId,
      role: roleRaw as PlatformRole,
      scopeType,
      scopeId,
      grantedByUserId: actor.id,
      companyId: s.companyId,
    });
    revalidatePath(`/app/s/${siteId}/settings/users`);
  }

  // P18 A.2: invite a colleague with any TENANT role. Tenant-facing (a
  // company_admin inside the app, not a super_admin), so the trial user limit
  // is enforced in the gate, not here — this only surfaces the refusal.
  async function inviteAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const { redirect } = await import("next/navigation");
    if (!canAccessCompany(actor, s.companyId)) {
      redirect(`/app/s/${siteId}/settings/users?invite=forbidden`);
      return;
    }
    const email = formData.get("inviteEmail");
    const name = formData.get("inviteName");
    const role = formData.get("inviteRole");
    if (
      typeof email !== "string" ||
      typeof name !== "string" ||
      !GRANTABLE_ROLES.includes(role as PlatformRole)
    ) {
      redirect(`/app/s/${siteId}/settings/users?invite=failed`);
      return;
    }
    try {
      await inviteTenantUser({
        companyId: s.companyId,
        email,
        name,
        role: role as PlatformRole,
        actorUserId: actor.id,
      });
    } catch (err) {
      if (err instanceof TenantInviteError) {
        redirect(
          `/app/s/${siteId}/settings/users?invite=${err.message === "user-limit-reached" ? "limit" : "failed"}`,
        );
      }
      throw err;
    }
    revalidatePath(`/app/s/${siteId}/settings/users`);
    redirect(`/app/s/${siteId}/settings/users?invite=sent`);
  }

  async function revokeAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).usersPage;
    if (!canAccessCompany(actor, s.companyId)) {
      throw new Error(d.readOnlyNote);
    }
    const id = formData.get("roleAssignmentId");
    if (typeof id === "string" && id.length > 0) {
      await revokeRoleAssignment(id, actor.id, s.companyId);
    }
    revalidatePath(`/app/s/${siteId}/settings/users`);
  }

  const [users, sites, orgUnits] = await Promise.all([
    prisma.platformUser.findMany({
      where: { companyId },
      include: { roleAssignments: { where: { revokedAt: null } } },
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.orgUnit.findMany({
      where: { site: { companyId } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  // Null for a customer tenant (no limit); a number for a trial.
  const tenant = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tenantKind: true },
  });
  const userLimit = tenant ? trialUserLimit(tenant.tenantKind) : null;
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const orgUnitName = new Map(orgUnits.map((o) => [o.id, o.name]));

  function scopeLabel(scopeType: ScopeType, scopeId: string | null): string {
    if (scopeType === "SITE") {
      return `${dict.scopeTypeLabels.SITE}: ${scopeId ? (siteName.get(scopeId) ?? dict.none) : dict.none}`;
    }
    if (scopeType === "ORG_UNIT") {
      return `${dict.scopeTypeLabels.ORG_UNIT}: ${scopeId ? (orgUnitName.get(scopeId) ?? dict.none) : dict.none}`;
    }
    return dict.scopeTypeLabels[scopeType];
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-technical text-xs uppercase tracking-[0.2em] text-foreground-subtle">
          {dict.eyebrow}
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-foreground">
          {dict.heading}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">{dict.intro}</p>
      </div>

      {canManage && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-heading text-sm font-bold">
            {trialDict.inviteHeading}
          </h2>
          {userLimit !== null && (
            <p className="text-xs text-foreground-muted">
              {trialDict.inviteUsage
                .replace("{current}", String(users.length))
                .replace("{limit}", String(userLimit))}
            </p>
          )}
          {invite === "sent" && (
            <p className="text-sm text-foreground">{trialDict.inviteSent}</p>
          )}
          {invite === "limit" && (
            <p className="text-sm text-coral">
              {trialDict.inviteLimitReached.replace(
                "{limit}",
                String(userLimit ?? 0),
              )}
            </p>
          )}
          {(invite === "failed" || invite === "forbidden") && (
            <p className="text-sm text-coral">{trialDict.inviteFailed}</p>
          )}
          <form action={inviteAction} className="flex flex-wrap gap-3 text-sm">
            <label className="flex flex-col gap-1">
              {trialDict.inviteName}
              <input
                name="inviteName"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {trialDict.inviteEmail}
              <input
                name="inviteEmail"
                type="email"
                required
                className="rounded border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1">
              {trialDict.inviteRole}
              <select
                name="inviteRole"
                className="rounded border border-border bg-background px-2 py-1"
              >
                {GRANTABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {dict.roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="self-end rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {trialDict.inviteButton}
            </button>
          </form>
        </section>
      )}

      {canManage && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-heading text-sm font-bold">
            {dict.grantHeading}
          </h2>
          <form action={grantAction} className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                {dict.userLabel}
                <select
                  name="platformUserId"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.roleLabel}
                <select
                  name="role"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {GRANTABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {dict.roleLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.scopeTypeLabel}
                <select
                  name="scopeType"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  {SCOPE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {dict.scopeTypeLabels[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                {dict.targetLabel}
                <select
                  name="target"
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="">{dict.none}</option>
                  {sites.map((s) => (
                    <option key={`site:${s.id}`} value={`site:${s.id}`}>
                      {dict.scopeTypeLabels.SITE}: {s.name}
                    </option>
                  ))}
                  {orgUnits.map((o) => (
                    <option key={`orgunit:${o.id}`} value={`orgunit:${o.id}`}>
                      {dict.scopeTypeLabels.ORG_UNIT}: {o.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              className="self-start rounded-[var(--radius-md)] bg-accent px-4 py-2 font-medium text-background"
            >
              {dict.grantButton}
            </button>
          </form>
        </section>
      )}

      {!canManage && (
        <p className="text-sm text-foreground-muted">{dict.readOnlyNote}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold">{dict.listHeading}</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-1 pr-4">{dict.colUser}</th>
              <th className="py-1 pr-4">{dict.colRole}</th>
              <th className="py-1 pr-4">{dict.colScope}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {users.flatMap((u) =>
              u.roleAssignments.length === 0
                ? [
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-1.5 pr-4 font-medium text-foreground">
                        {u.name}
                      </td>
                      <td
                        className="py-1.5 pr-4 text-foreground-subtle"
                        colSpan={3}
                      >
                        {dict.noAssignments}
                      </td>
                    </tr>,
                  ]
                : u.roleAssignments.map((ra) => (
                    <tr
                      key={ra.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-1.5 pr-4 font-medium text-foreground">
                        {u.name}
                      </td>
                      <td className="py-1.5 pr-4 text-foreground-muted">
                        {dict.roleLabels[ra.role]}
                      </td>
                      <td className="py-1.5 pr-4 text-foreground-muted">
                        {scopeLabel(ra.scopeType, ra.scopeId)}
                      </td>
                      <td className="py-1.5">
                        {canManage && (
                          <form action={revokeAction}>
                            <input
                              type="hidden"
                              name="roleAssignmentId"
                              value={ra.id}
                            />
                            <button
                              type="submit"
                              className="text-coral hover:underline"
                            >
                              {dict.revoke}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )),
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
