import { revalidatePath } from "next/cache";
import {
  type PlatformRole,
  PlatformRole as Role,
} from "@/generated/prisma/enums";
import {
  COMPANY_SCOPED_ROLES,
  changeUserRole,
  setUserDisabled,
} from "@/lib/admin/user-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P13 §2.4: cross-tenant user & role overview. Change a tenant role or disable
// an account (audited); super_admin / l3_support shown read-only (§10).
export default async function UsersPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).usersPage;

  async function disableAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const userId = formData.get("userId");
    const disabled = formData.get("disabled") === "true";
    if (typeof userId !== "string") return;
    await setUserDisabled({ userId, disabled, actorUserId: actor.id });
    revalidatePath("/admin/users");
  }

  async function roleAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const userId = formData.get("userId");
    const role = formData.get("role");
    if (
      typeof userId !== "string" ||
      typeof role !== "string" ||
      !(COMPANY_SCOPED_ROLES as string[]).includes(role)
    ) {
      return;
    }
    await changeUserRole({
      userId,
      role: role as PlatformRole,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/users");
  }

  const [users, companies] = await Promise.all([
    prisma.platformUser.findMany({
      orderBy: [{ companyId: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { roleAssignments: true } },
      },
    }),
    prisma.company.findMany({ select: { id: true, name: true } }),
  ]);
  const companyName = new Map(companies.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{dict.heading}</h1>
        <p className="mt-1 text-xs text-gray-500">{dict.intro}</p>
      </div>

      {users.length === 0 ? (
        <p className="text-sm">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3">{dict.colName}</th>
              <th className="py-1 pr-3">{dict.colEmail}</th>
              <th className="py-1 pr-3">{dict.colRole}</th>
              <th className="py-1 pr-3">{dict.colCompany}</th>
              <th className="py-1 pr-3">{dict.colStatus}</th>
              <th className="py-1 pr-3">{dict.colGrants}</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isOperator =
                u.role === Role.SUPER_ADMIN || u.role === Role.L3_SUPPORT;
              return (
                <tr key={u.id} className="border-b last:border-0 align-top">
                  <td className="py-1 pr-3">{u.name}</td>
                  <td className="py-1 pr-3">{u.email}</td>
                  <td className="py-1 pr-3 font-mono">{u.role}</td>
                  <td className="py-1 pr-3">
                    {u.companyId
                      ? (companyName.get(u.companyId) ??
                        u.companyId.slice(0, 8))
                      : "—"}
                  </td>
                  <td className="py-1 pr-3">
                    {u.disabledAt ? dict.statusDisabled : dict.statusActive}
                  </td>
                  <td className="py-1 pr-3">{u._count.roleAssignments}</td>
                  <td className="py-1">
                    {isOperator ? (
                      <span className="text-gray-400">{dict.operator}</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <form action={disableAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            type="hidden"
                            name="disabled"
                            value={u.disabledAt ? "false" : "true"}
                          />
                          <button type="submit" className="underline">
                            {u.disabledAt ? dict.enable : dict.disable}
                          </button>
                        </form>
                        {u.companyId && (
                          <form
                            action={roleAction}
                            className="flex items-center gap-1"
                          >
                            <input type="hidden" name="userId" value={u.id} />
                            <select
                              name="role"
                              defaultValue={u.role}
                              className="rounded border px-1 py-0.5"
                            >
                              {COMPANY_SCOPED_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded border px-2 py-0.5"
                            >
                              {dict.changeRole}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
