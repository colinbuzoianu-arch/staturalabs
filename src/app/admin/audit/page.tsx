import type { Prisma } from "@/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

// P13 §2.4: cross-tenant audit log viewer (read-only, filterable). Health reads
// appear as events (who/when) with no health content — the diff never carries
// health values by construction.
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    action?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const locale = await getLocale();
  const dict = getAdminDictionary(locale).auditPage;

  const where: Prisma.AuditEventWhereInput = {};
  if (sp.company) where.companyId = sp.company;
  if (sp.action) where.action = { contains: sp.action };
  if (sp.from || sp.to) {
    where.createdAt = {};
    if (sp.from) where.createdAt.gte = new Date(sp.from);
    if (sp.to) where.createdAt.lte = new Date(`${sp.to}T23:59:59.999Z`);
  }

  const events = await prisma.auditEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const actorIds = [
    ...new Set(
      events.map((e) => e.actorUserId).filter((x): x is string => !!x),
    ),
  ];
  const actors = await prisma.platformUser.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{dict.heading}</h1>
        <p className="mt-1 text-xs text-gray-500">{dict.intro}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col">
          {dict.filterCompany}
          <input
            name="company"
            defaultValue={sp.company ?? ""}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          {dict.filterAction}
          <input
            name="action"
            defaultValue={sp.action ?? ""}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          {dict.filterFrom}
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          {dict.filterTo}
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="rounded border px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded border px-3 py-1">
          {dict.apply}
        </button>
      </form>

      {events.length === 0 ? (
        <p className="text-sm">{dict.empty}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3">{dict.colWhen}</th>
              <th className="py-1 pr-3">{dict.colActor}</th>
              <th className="py-1 pr-3">{dict.colAction}</th>
              <th className="py-1 pr-3">{dict.colEntity}</th>
              <th className="py-1">{dict.colCompany}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const actor = e.actorUserId ? actorById.get(e.actorUserId) : null;
              return (
                <tr key={e.id} className="border-b last:border-0 align-top">
                  <td className="py-1 pr-3 whitespace-nowrap">
                    {e.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="py-1 pr-3">
                    {actor ? `${actor.name}` : dict.system}
                  </td>
                  <td className="py-1 pr-3 font-mono">{e.action}</td>
                  <td className="py-1 pr-3">
                    {e.entityType}
                    {e.entityId ? ` ${e.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td className="py-1">
                    {e.companyId?.slice(0, 8) ?? dict.system}
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
