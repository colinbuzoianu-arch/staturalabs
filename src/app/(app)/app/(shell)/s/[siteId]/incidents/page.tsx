import { redirect } from "next/navigation";

// P10a: the incidents module lands on the reports list.
export default async function IncidentsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/incidents/reports`);
}
