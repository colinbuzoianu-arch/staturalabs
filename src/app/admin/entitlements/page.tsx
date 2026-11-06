import { revalidatePath } from "next/cache";
import type { ModuleKey } from "@/generated/prisma/enums";
import {
  applyTemplateToCompany,
  entitlementModuleKeys,
  getDefaultTemplateKeys,
  setDefaultTemplateKey,
  toggleCompanyModule,
} from "@/lib/admin/entitlement-admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { getModuleDefinition, moduleStatus } from "@/lib/modules/registry";
import { prisma } from "@/lib/prisma";

// P13 §2.2: the super-admin module-entitlement matrix + default template.
export default async function EntitlementsPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).entitlementsPage;
  const moduleKeys = entitlementModuleKeys();

  async function toggleTemplateAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const key = formData.get("key") as ModuleKey | null;
    const on = formData.get("on") === "true";
    if (!key) return;
    await setDefaultTemplateKey({ key, on, actorUserId: actor.id });
    revalidatePath("/admin/entitlements");
  }

  async function toggleCellAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    const key = formData.get("key") as ModuleKey | null;
    const enable = formData.get("enable") === "true";
    if (typeof companyId !== "string" || !key) return;
    await toggleCompanyModule({
      companyId,
      key,
      enable,
      actorUserId: actor.id,
    });
    revalidatePath("/admin/entitlements");
  }

  async function applyTemplateAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    if (typeof companyId !== "string") return;
    await applyTemplateToCompany({ companyId, actorUserId: actor.id });
    revalidatePath("/admin/entitlements");
  }

  const [companies, templateKeys] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: "asc" },
      include: { companyModules: { select: { moduleKey: true } } },
    }),
    getDefaultTemplateKeys(),
  ]);
  const templateSet = new Set(templateKeys);
  const statusOf = (k: ModuleKey) => moduleStatus(getModuleDefinition(k));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{dict.heading}</h1>

      {/* Default template */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{dict.templateHeading}</h2>
        <div className="flex flex-wrap gap-2">
          {moduleKeys.map((k) => {
            const inTpl = templateSet.has(k);
            const st = statusOf(k);
            return (
              <form key={k} action={toggleTemplateAction}>
                <input type="hidden" name="key" value={k} />
                <input
                  type="hidden"
                  name="on"
                  value={inTpl ? "false" : "true"}
                />
                <button
                  type="submit"
                  disabled={st === "planned"}
                  className={`rounded border px-2 py-1 text-xs ${inTpl ? "bg-black text-white dark:bg-white dark:text-black" : ""} ${st === "planned" ? "opacity-40" : ""}`}
                  title={st !== "stable" ? st : undefined}
                >
                  {k}
                  {st === "beta" ? ` (${dict.beta})` : ""}
                  {st === "planned" ? ` (${dict.planned})` : ""}
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Matrix */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{dict.matrixHeading}</h2>
        {companies.length === 0 ? (
          <p className="text-sm">{dict.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-1 pr-3">{dict.moduleCol}</th>
                  {moduleKeys.map((k) => (
                    <th key={k} className="px-2 py-1 align-bottom">
                      <span className="[writing-mode:vertical-rl] rotate-180">
                        {k}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-1" />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const enabled = new Set(
                    c.companyModules.map((m) => m.moduleKey),
                  );
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-1 pr-3 whitespace-nowrap">{c.name}</td>
                      {moduleKeys.map((k) => {
                        const on = enabled.has(k);
                        const st = statusOf(k);
                        return (
                          <td key={k} className="px-2 py-1 text-center">
                            <form action={toggleCellAction}>
                              <input
                                type="hidden"
                                name="companyId"
                                value={c.id}
                              />
                              <input type="hidden" name="key" value={k} />
                              <input
                                type="hidden"
                                name="enable"
                                value={on ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                disabled={st === "planned"}
                                className={`h-5 w-5 rounded border text-[10px] ${on ? "bg-black text-white dark:bg-white dark:text-black" : ""} ${st === "planned" ? "opacity-40" : ""}`}
                                title={st === "beta" ? dict.beta : undefined}
                              >
                                {on ? "✓" : ""}
                              </button>
                            </form>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1">
                        <form action={applyTemplateAction}>
                          <input type="hidden" name="companyId" value={c.id} />
                          <button
                            type="submit"
                            className="rounded border px-2 py-0.5 text-[10px]"
                          >
                            {dict.applyTemplate}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
