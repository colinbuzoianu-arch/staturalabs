import "server-only";

import { redirect } from "next/navigation";
import { PlatformRole } from "@/generated/prisma/enums";
import type { PlatformUserModel } from "@/generated/prisma/models";
import { getCurrentPlatformUser } from "./current-user";

// Gate for the internal /admin tool (super_admin only, deliberately — not
// company_admin/site_admin, this isn't a scoped-down client-facing
// surface). Redirects rather than 403ing so an unauthorized-but-logged-in
// visitor doesn't get a page that confirms the tool exists; call this from
// every page AND every Server Action under /admin, not just the layout —
// Server Actions are reachable directly via POST, bypassing the page/layout
// entirely.
export async function requireSuperAdmin(): Promise<PlatformUserModel> {
  const user = await getCurrentPlatformUser();
  if (!user) redirect("/login");
  if (user.role !== PlatformRole.SUPER_ADMIN) redirect("/sites");
  return user;
}
