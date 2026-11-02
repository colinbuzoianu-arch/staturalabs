import { redirect } from "next/navigation";

// Risk module index → its first child (Arbeitsplätze). The module's own base
// path (/app/s/[siteId]/risk) has no page of its own; clicking the module in
// the sidebar lands on the workstations list.
export default async function RiskIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/risk/workstations`);
}
