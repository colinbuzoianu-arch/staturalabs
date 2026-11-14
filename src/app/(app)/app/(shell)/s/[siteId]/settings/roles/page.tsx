import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PlatformRole } from "@/generated/prisma/enums";
import {
  COMPANY_EDITABLE_ROLES,
  effectiveRoleBundle,
  getCompanyRoleBundles,
  grantablePermissions,
  RoleBundleGuardrailError,
  resetCompanyRoleBundle,
  setCompanyRoleBundle,
} from "@/lib/auth/company-role-bundle";
import { canAccessCompany } from "@/lib/auth/rbac";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

// P17 §3: company-editable role bundles. Company-admin edits the permission set
// for the three tenant roles; site admins see it read-only. Guardrails + audit
// live in setCompanyRoleBundle — this page only renders and dispatches.
export default async function RolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ status?: string; role?: string; message?: string }>;
}) {
  const { siteId } = await params;
  const { status, message } = await searchParams;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).rolesPage;
  const companyId = site.companyId;
  const canManage = canAccessCompany(user, companyId);

  const overrides = await getCompanyRoleBundles(companyId);

  async function saveAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).rolesPage;
    if (!canAccessCompany(actor, s.companyId)) {
      redirect(
        `/app/s/${siteId}/settings/roles?status=error&message=${encodeURIComponent(d.readOnlyNote)}`,
      );
    }
    const roleRaw = formData.get("role");
    if (
      typeof roleRaw !== "string" ||
      !COMPANY_EDITABLE_ROLES.includes(roleRaw as PlatformRole)
    ) {
      redirect(`/app/s/${siteId}/settings/roles?status=error`);
    }
    const role = roleRaw as PlatformRole;
    const permissions = formData
      .getAll("permission")
      .filter((v): v is string => typeof v === "string");
    try {
      await setCompanyRoleBundle({
        companyId: s.companyId,
        role,
        permissions,
        actorUserId: actor.id,
      });
    } catch (error) {
      const msg =
        error instanceof RoleBundleGuardrailError
          ? error.message
          : "Unexpected error";
      redirect(
        `/app/s/${siteId}/settings/roles?status=error&role=${role}&message=${encodeURIComponent(msg)}`,
      );
    }
    revalidatePath(`/app/s/${siteId}/settings/roles`);
    redirect(`/app/s/${siteId}/settings/roles?status=saved&role=${role}`);
  }

  async function resetAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).rolesPage;
    if (!canAccessCompany(actor, s.companyId)) {
      redirect(
        `/app/s/${siteId}/settings/roles?status=error&message=${encodeURIComponent(d.readOnlyNote)}`,
      );
    }
    const roleRaw = formData.get("role");
    if (
      typeof roleRaw !== "string" ||
      !COMPANY_EDITABLE_ROLES.includes(roleRaw as PlatformRole)
    ) {
      redirect(`/app/s/${siteId}/settings/roles?status=error`);
    }
    const role = roleRaw as PlatformRole;
    await resetCompanyRoleBundle({
      companyId: s.companyId,
      role,
      actorUserId: actor.id,
    });
    revalidatePath(`/app/s/${siteId}/settings/roles`);
    redirect(`/app/s/${siteId}/settings/roles?status=reset&role=${role}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-border">
          {dict.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-bold">{dict.heading}</h1>
        <p className="max-w-3xl text-sm text-foreground/80">{dict.intro}</p>
        <p className="max-w-3xl rounded border border-border bg-surface p-3 text-xs text-foreground/70">
          {dict.guardrailsNote}
        </p>
        {!canManage && (
          <p className="text-sm font-semibold text-info">{dict.readOnlyNote}</p>
        )}
      </header>

      {status === "saved" && (
        <p className="rounded bg-status-low/15 p-2 text-sm">{dict.savedMsg}</p>
      )}
      {status === "reset" && (
        <p className="rounded bg-status-low/15 p-2 text-sm">{dict.resetMsg}</p>
      )}
      {status === "error" && (
        <p className="rounded bg-status-high/15 p-2 text-sm">
          {dict.errorPrefix}
          {message ? `: ${message}` : ""}
        </p>
      )}

      {COMPANY_EDITABLE_ROLES.map((role) => {
        const override = overrides.get(role) ?? null;
        const effective = effectiveRoleBundle(role, override);
        const ceiling = [...grantablePermissions(role)].sort();
        const isCustom = override !== null;
        return (
          <section
            key={role}
            className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-bold">
                {dict.roleLabels[role as keyof typeof dict.roleLabels]}
              </h2>
              <span
                className={`rounded px-2 py-0.5 text-xs ${isCustom ? "bg-accent-secondary/20" : "bg-border/20"}`}
              >
                {isCustom ? dict.customTag : dict.defaultTag}
              </span>
            </div>
            <form action={saveAction} className="flex flex-col gap-3">
              <input type="hidden" name="role" value={role} />
              <fieldset
                disabled={!canManage}
                className="flex flex-col gap-2 disabled:opacity-60"
              >
                <legend className="text-sm font-semibold">
                  {dict.permissionsHeading}
                </legend>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                  {ceiling.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2 font-mono text-xs"
                    >
                      <input
                        type="checkbox"
                        name="permission"
                        value={perm}
                        defaultChecked={effective.has(perm)}
                      />
                      {perm}
                    </label>
                  ))}
                </div>
              </fieldset>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-background"
                  >
                    {dict.save}
                  </button>
                </div>
              )}
            </form>
            {canManage && isCustom && (
              <form action={resetAction}>
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
                >
                  {dict.reset}
                </button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
