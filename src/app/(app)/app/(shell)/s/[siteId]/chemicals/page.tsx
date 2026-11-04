import { redirect } from "next/navigation";

export default async function ChemicalsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/chemicals/register`);
}
