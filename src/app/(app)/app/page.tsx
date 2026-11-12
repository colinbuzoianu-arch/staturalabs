import { redirect } from "next/navigation";
import { PlatformRole } from "@/generated/prisma/enums";
import { getAccessibleSites } from "@/lib/auth/accessible-sites";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";

// /app is the authenticated landing resolver (SLD_RESTRUCTURE_PLAN §2.3).
// There is no standalone site-chooser page any more — a signed-in user lands
// straight on a site's cockpit (inside the sidebar shell) and switches sites
// from the sidebar's own location switcher. super_admin/l3_support go to the
// cross-tenant /admin console instead. A user with no accessible site falls
// back to the personal inbox (/app/me), which renders without a site context.
export default async function AppIndexPage() {
  const user = await requireAuthenticatedUser();

  if (
    user.role === PlatformRole.SUPER_ADMIN ||
    user.role === PlatformRole.L3_SUPPORT
  ) {
    redirect("/admin");
  }

  const sites = await getAccessibleSites(user);
  if (sites.length > 0) {
    redirect(`/app/s/${sites[0].id}`);
  }

  redirect("/app/me");
}
