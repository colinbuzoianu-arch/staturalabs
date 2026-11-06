import { revalidatePath } from "next/cache";
import { setFeatureFlag } from "@/lib/admin/feature-flags";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P13 §2.5: super-admin feature flags (global or per tenant).
export default async function FlagsPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).flagsPage;

  async function setFlagAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const key = formData.get("key");
    const companyId = formData.get("companyId");
    const enabled = formData.get("enabled") === "on";
    if (typeof key !== "string") return;
    await setFeatureFlag({
      key,
      companyId:
        typeof companyId === "string" && companyId.length > 0
          ? companyId
          : null,
      enabled,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/flags");
  }

  const [flags, companies] = await Promise.all([
    prisma.featureFlag.findMany({
      orderBy: [{ key: "asc" }, { companyId: "asc" }],
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

      <form
        action={setFlagAction}
        className="flex flex-wrap items-end gap-2 text-xs"
      >
        <label className="flex flex-col">
          {dict.keyLabel}
          <input name="key" required className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col">
          {dict.scopeLabel}
          <select name="companyId" className="rounded border px-2 py-1">
            <option value="">{dict.globalScope}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="enabled" /> {dict.enabledLabel}
        </label>
        <button type="submit" className="rounded border px-3 py-1">
          {dict.setFlag}
        </button>
      </form>

      {flags.length === 0 ? (
        <p className="text-sm">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3">{dict.colKey}</th>
              <th className="py-1 pr-3">{dict.colScope}</th>
              <th className="py-1 pr-3">{dict.colEnabled}</th>
              <th className="py-1">{dict.colSetAt}</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="py-1 pr-3 font-mono">{f.key}</td>
                <td className="py-1 pr-3">
                  {f.companyId
                    ? (companyName.get(f.companyId) ?? f.companyId.slice(0, 8))
                    : dict.globalScope}
                </td>
                <td className="py-1 pr-3">{f.enabled ? dict.on : dict.off}</td>
                <td className="py-1">
                  {f.updatedAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
