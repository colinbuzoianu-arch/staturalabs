import "server-only";

import type { PlatformUserModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { canAccessSite } from "./rbac";

// Lists every site the given user can access, for the dashboard landing
// view. Delegates the actual per-site decision to canAccessSite (rbac.ts)
// rather than re-deriving per-role filtering here, so this listing and the
// single-resource guards in require-access.ts share one source of truth for
// "can this user see this site" — at the cost of one canAccessSite call per
// site in the system. Fine at current scale; would need a real per-role
// query if the site count grows large.
export async function getAccessibleSites(user: PlatformUserModel) {
  const allSites = await prisma.site.findMany({
    include: { company: true },
    orderBy: { name: "asc" },
  });

  const checked = await Promise.all(
    allSites.map(async (site) => ({
      site,
      allowed: await canAccessSite(user, site.id),
    })),
  );

  return checked.filter((c) => c.allowed).map((c) => c.site);
}
