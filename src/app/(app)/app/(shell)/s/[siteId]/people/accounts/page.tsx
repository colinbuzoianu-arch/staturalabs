import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  type AccountStatus,
  EmployeeAccountProvisioning,
  type ProvisionablePerson,
} from "@/components/employee-account-provisioning";
import { recordAuditEvent } from "@/lib/audit/audit-event";
import { disableOffboardedAccounts } from "@/lib/auth/offboarding";
import { canAccessCompany } from "@/lib/auth/rbac";
import { requireSiteAdministrationAccess } from "@/lib/auth/require-access";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P17 §5 (SLD_P17_TENANT_ROLES_APPROVED.md): employee accounts — the tenant
// switch, the work-e-mail field that decides the provisioning path, bulk
// provisioning (in the client component, see its header for why), and the
// offboarding run.
//
// Company-level by nature: granting a login is "Users & roles" in the §2
// matrix, so everything that writes here is gated on canAccessCompany — a
// site_admin reads the page and gets the read-only note.
export default async function EmployeeAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ checked?: string; disabled?: string }>;
}) {
  const { siteId } = await params;
  const { checked, disabled } = await searchParams;
  const { user, site } = await requireSiteAdministrationAccess(siteId);
  const locale = await getLocale();
  const dict = getAdministrationDictionary(locale).employeeAccounts;
  const companyId = site.companyId;
  const canManage = canAccessCompany(user, companyId);

  async function setSwitchAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).employeeAccounts;
    if (!canAccessCompany(actor, s.companyId)) throw new Error(d.readOnlyNote);
    const enabled = formData.get("enabled") === "true";
    await prisma.company.update({
      where: { id: s.companyId },
      data: { employeeAccountsEnabled: enabled },
    });
    await recordAuditEvent({
      actorUserId: actor.id,
      action: "company.employee_accounts_toggle",
      entityType: "Company",
      entityId: s.companyId,
      companyId: s.companyId,
      diff: { employeeAccountsEnabled: enabled },
    });
    revalidatePath(`/app/s/${siteId}/people/accounts`);
  }

  async function setEmailAction(formData: FormData) {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).employeeAccounts;
    if (!canAccessCompany(actor, s.companyId)) throw new Error(d.readOnlyNote);
    const personId = formData.get("personId");
    const emailRaw = formData.get("email");
    if (typeof personId !== "string" || personId.length === 0) return;
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { companyId: true },
    });
    if (!person || person.companyId !== s.companyId) return;
    const email =
      typeof emailRaw === "string" && emailRaw.trim().length > 0
        ? emailRaw.trim()
        : null;
    await prisma.person.update({ where: { id: personId }, data: { email } });
    await recordAuditEvent({
      actorUserId: actor.id,
      action: "person.set_email",
      entityType: "Person",
      entityId: personId,
      companyId: s.companyId,
      // Whether an address is on file, never the address itself in the log.
      diff: { hasEmail: email !== null },
    });
    revalidatePath(`/app/s/${siteId}/people/accounts`);
  }

  async function offboardAction() {
    "use server";
    const { user: actor, site: s } =
      await requireSiteAdministrationAccess(siteId);
    const d = getAdministrationDictionary(await getLocale()).employeeAccounts;
    if (!canAccessCompany(actor, s.companyId)) throw new Error(d.readOnlyNote);
    const result = await disableOffboardedAccounts({
      companyId: s.companyId,
      actorUserId: actor.id,
    });
    // The counts ride back on the query string — nothing secret, and it keeps
    // the page a plain Server Component.
    const { redirect } = await import("next/navigation");
    redirect(
      `/app/s/${siteId}/people/accounts?checked=${result.checked}&disabled=${result.disabled.length}`,
    );
  }

  const [company, people] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { employeeAccountsEnabled: true },
    }),
    prisma.person.findMany({
      where: { companyId, anonymisedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        personnelNumber: true,
        email: true,
        platformUserId: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  const accountsEnabled = company?.employeeAccountsEnabled === true;

  // Account status per person: the linked login (if any) plus whether a code
  // is still outstanding. Two batched queries, no per-row lookups.
  const linkedIds = people
    .map((p) => p.platformUserId)
    .filter((id): id is string => id !== null);
  const [accounts, pendingCodes] = await Promise.all([
    linkedIds.length > 0
      ? prisma.platformUser.findMany({
          where: { id: { in: linkedIds }, companyId },
          select: { id: true, disabledAt: true },
        })
      : Promise.resolve([]),
    prisma.employeeAccessCode.findMany({
      where: {
        companyId,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { personId: true },
    }),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const pendingByPerson = new Set(pendingCodes.map((c) => c.personId));

  function statusOf(person: (typeof people)[number]): AccountStatus {
    if (!person.platformUserId) return "none";
    const account = accountById.get(person.platformUserId);
    if (!account) return "none";
    if (account.disabledAt) return "disabled";
    if (pendingByPerson.has(person.id)) return "code-pending";
    if (person.email) return "email-invited";
    return "active";
  }

  const rows: ProvisionablePerson[] = people.map((p) => ({
    id: p.id,
    name: `${p.lastName}, ${p.firstName}`,
    personnelNumber: p.personnelNumber,
    email: p.email,
    status: statusOf(p),
  }));

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
        <Link
          href={`/app/s/${siteId}/people`}
          className="mt-2 inline-block text-sm text-accent hover:underline"
        >
          {dict.back}
        </Link>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 print:hidden">
        <h2 className="font-heading text-sm font-bold">{dict.switchHeading}</h2>
        <p className="text-sm text-foreground-muted">{dict.switchIntro}</p>
        <p className="text-sm text-foreground">
          {accountsEnabled ? dict.switchStateOn : dict.switchStateOff}
        </p>
        {canManage && (
          <form action={setSwitchAction}>
            <input
              type="hidden"
              name="enabled"
              value={accountsEnabled ? "false" : "true"}
            />
            <button
              type="submit"
              className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              {accountsEnabled ? dict.disableButton : dict.enableButton}
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 print:hidden">
        <h2 className="font-heading text-sm font-bold">
          {dict.offboardHeading}
        </h2>
        <p className="text-sm text-foreground-muted">{dict.offboardIntro}</p>
        {checked !== undefined && (
          <p className="text-sm text-foreground">
            {dict.offboardResult
              .replace("{checked}", checked ?? "0")
              .replace("{disabled}", disabled ?? "0")}
          </p>
        )}
        {canManage && (
          <form action={offboardAction}>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium text-foreground"
            >
              {dict.offboardButton}
            </button>
          </form>
        )}
      </section>

      {!canManage && (
        <p className="text-sm text-foreground-muted">{dict.readOnlyNote}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold print:hidden">
          {dict.listHeading}
        </h2>
        {canManage ? (
          <EmployeeAccountProvisioning
            siteId={siteId}
            people={rows}
            accountsEnabled={accountsEnabled}
            dict={dict}
            locale={locale}
          />
        ) : null}
      </section>

      {canManage && (
        <section className="flex flex-col gap-2 print:hidden">
          <h2 className="font-heading text-sm font-bold">{dict.colEmail}</h2>
          {rows.map((p) => (
            <form
              key={p.id}
              action={setEmailAction}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <input type="hidden" name="personId" value={p.id} />
              <span className="min-w-48 text-foreground">{p.name}</span>
              <input
                name="email"
                type="email"
                defaultValue={p.email ?? ""}
                placeholder={dict.emailPlaceholder}
                className="rounded border border-border bg-background px-2 py-1"
              />
              <button
                type="submit"
                className="text-accent hover:underline"
                disabled={!canManage}
              >
                {dict.setEmailButton}
              </button>
            </form>
          ))}
        </section>
      )}
    </div>
  );
}
