import { revalidatePath } from "next/cache";
import { getAiCap, getCompanyAiUsage, setAiCap } from "@/lib/ai/usage";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P15 S8: super-admin AI usage + per-tenant monthly cap. The AI entitlement is
// the chemicals.ai feature flag (/admin/flags); this shows what each tenant has
// spent this month and lets a cap be set. super_admin-only.
export default async function AiUsagePage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).aiUsagePage;

  async function setCapAction(formData: FormData) {
    "use server";
    const actor = await requireSuperAdmin();
    const companyId = formData.get("companyId");
    if (typeof companyId !== "string" || !companyId) return;
    const parse = (k: string): number | null => {
      const v = formData.get(k);
      if (typeof v !== "string" || v.trim() === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
    };
    await setAiCap({
      companyId,
      monthlyCallCap: parse("monthlyCallCap"),
      monthlyTokenCap: parse("monthlyTokenCap"),
      actorUserId: actor.id,
    });
    revalidatePath("/admin/ai-usage");
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const rows = await Promise.all(
    companies.map(async (c) => ({
      ...c,
      usage: await getCompanyAiUsage(c.id),
      cap: await getAiCap(c.id),
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{dict.heading}</h1>
        <p className="mt-1 text-xs text-gray-500">{dict.intro}</p>
      </div>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b">
            <th className="py-1">{dict.colTenant}</th>
            <th className="py-1">{dict.colCalls}</th>
            <th className="py-1">{dict.colTokens}</th>
            <th className="py-1">{dict.colCallCap}</th>
            <th className="py-1">{dict.colTokenCap}</th>
            <th className="py-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b align-top">
              <td className="py-1.5">{r.name}</td>
              <td className="py-1.5">{r.usage.calls}</td>
              <td className="py-1.5">
                {r.usage.inputTokens} / {r.usage.outputTokens}
              </td>
              <td colSpan={3} className="py-1.5">
                <form
                  action={setCapAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="companyId" value={r.id} />
                  <input
                    name="monthlyCallCap"
                    type="number"
                    min={0}
                    defaultValue={r.cap?.monthlyCallCap ?? ""}
                    placeholder={dict.noCap}
                    className="w-24 rounded border px-2 py-1"
                  />
                  <input
                    name="monthlyTokenCap"
                    type="number"
                    min={0}
                    defaultValue={r.cap?.monthlyTokenCap ?? ""}
                    placeholder={dict.noCap}
                    className="w-32 rounded border px-2 py-1"
                  />
                  <button
                    type="submit"
                    className="rounded border px-2 py-1 hover:bg-gray-100"
                  >
                    {dict.save}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-400">{dict.capHint}</p>
    </div>
  );
}
