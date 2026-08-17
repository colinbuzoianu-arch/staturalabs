import { redirect } from "next/navigation";

// SLD_IMPLEMENTATION_PLAN_austria-first.md §7 B6: the floor map is now the
// site page's own default content (../page.tsx) rather than a separate,
// buried route — this route stays only as a redirect so existing links/
// bookmarks (and the `?planId=` deep link this page used to support) keep
// working, canonicalized to the promoted location.
export default async function SiteMapRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ planId?: string | string[] }>;
}) {
  const { siteId } = await params;
  const { planId } = await searchParams;
  const query =
    typeof planId === "string" ? `?planId=${encodeURIComponent(planId)}` : "";
  redirect(`/sites/${siteId}${query}`);
}
