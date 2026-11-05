import { redirect } from "next/navigation";

export default async function InspectionsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/inspections/planned`);
}
