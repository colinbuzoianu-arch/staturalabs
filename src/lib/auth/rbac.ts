import "server-only";

import type { PlatformUserModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";

// Exhaustive by construction: `role` is typed as `never` here, so a role
// added to the PlatformRole enum without a matching case above fails to
// compile, and any value that still slips through at runtime (e.g. a
// hand-edited row) is denied rather than silently allowed.
function unrecognizedRole(role: never): false {
  console.error(`Unrecognized platform role, denying access: ${String(role)}`);
  return false;
}

// Whole-company scope: super_admin and l3_support (platform-level, above
// any tenant) and company_admin for their own company. site_admin never has
// company-wide scope — see canAccessSite for their per-site grants.
export function canAccessCompany(
  user: PlatformUserModel,
  companyId: string,
): boolean {
  switch (user.role) {
    case "SUPER_ADMIN":
    case "L3_SUPPORT":
      return true;
    case "COMPANY_ADMIN":
      return user.companyId === companyId;
    case "SITE_ADMIN":
      return false;
    default:
      return unrecognizedRole(user.role);
  }
}

// Site-level scope. company_admin's access is implicit (every site under
// their companyId); site_admin's access is explicit via SiteAssignment.
export async function canAccessSite(
  user: PlatformUserModel,
  siteId: string,
): Promise<boolean> {
  switch (user.role) {
    case "SUPER_ADMIN":
    case "L3_SUPPORT":
      return true;
    case "COMPANY_ADMIN": {
      if (!user.companyId) return false;
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { companyId: true },
      });
      return site?.companyId === user.companyId;
    }
    case "SITE_ADMIN": {
      const assignment = await prisma.siteAssignment.findUnique({
        where: { userId_siteId: { userId: user.id, siteId } },
      });
      return assignment !== null;
    }
    default:
      return unrecognizedRole(user.role);
  }
}
