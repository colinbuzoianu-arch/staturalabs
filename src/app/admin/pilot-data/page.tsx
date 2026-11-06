import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P13 §2.4: demo/pilot hygiene — everything carrying a pilotContext, across all
// tenants, so demo/pilot data stays visibly separate from real customer data.
// The reset/seed buttons live at /admin/demo-reset (name-marker guarded).
export default async function PilotDataPage() {
  await requireSuperAdmin();
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).pilotPage;

  const [assessments, sessions] = await Promise.all([
    prisma.riskAssessment.findMany({
      where: { pilotContext: { not: null } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        pilotContext: true,
        createdAt: true,
        site: { select: { company: { select: { name: true } } } },
        workstation: { select: { name: true } },
      },
      take: 200,
    }),
    prisma.assessmentSession.findMany({
      where: { pilotContext: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, pilotContext: true, createdAt: true },
      take: 200,
    }),
  ]);

  const rows = [
    ...assessments.map((a) => ({
      type: dict.assessment,
      title: a.workstation?.name ?? a.id.slice(0, 8),
      company: a.site.company.name,
      context: a.pilotContext ?? "",
      when: a.createdAt,
    })),
    ...sessions.map((s) => ({
      type: dict.session,
      title: s.id.slice(0, 8),
      company: "—",
      context: s.pilotContext ?? "",
      when: s.createdAt,
    })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{dict.heading}</h1>
        <p className="mt-1 text-xs text-gray-500">{dict.intro}</p>
        <p className="mt-1 text-xs">
          <Link href="/admin/demo-reset" className="underline">
            /admin/demo-reset
          </Link>
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3">{dict.colType}</th>
              <th className="py-1 pr-3">{dict.colTitle}</th>
              <th className="py-1 pr-3">{dict.colCompany}</th>
              <th className="py-1 pr-3">{dict.colContext}</th>
              <th className="py-1">{dict.colWhen}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.type}-${i}`} className="border-b last:border-0">
                <td className="py-1 pr-3">{r.type}</td>
                <td className="py-1 pr-3">{r.title}</td>
                <td className="py-1 pr-3">{r.company}</td>
                <td className="py-1 pr-3">{r.context}</td>
                <td className="py-1">{r.when.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
