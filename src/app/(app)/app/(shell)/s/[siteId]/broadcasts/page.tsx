import { redirect } from "next/navigation";

// The module lands on the inbox: everyone has one, senders have one too.
export default async function BroadcastsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  redirect(`/app/s/${siteId}/broadcasts/inbox`);
}
