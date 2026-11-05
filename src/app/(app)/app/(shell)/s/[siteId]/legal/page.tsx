import { redirect } from "next/navigation";

export default async function LegalIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/legal/register`);
}
