import "server-only";

import { cache } from "react";
import type { PlatformUserModel } from "@/generated/prisma/models";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// Data Access Layer entry point: the one place that turns a Supabase auth
// session into a platform_user row. `cache()` memoizes it for the lifetime
// of a single request/render pass, so calling it from multiple Server
// Components doesn't re-hit Supabase or the DB.
//
// Returns null for anyone without a matching platform_user row — including
// an authenticated Supabase user with no such row (e.g. an invite that
// created the auth account but was interrupted before provisioning
// finished). No session and no row both mean "not a platform user"; treat
// them identically rather than special-casing either.
export const getCurrentPlatformUser = cache(
  async (): Promise<PlatformUserModel | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const platformUser = await prisma.platformUser.findUnique({
      where: { id: user.id },
    });
    if (!platformUser) return null;

    // P13 §2.1: a user whose company is ARCHIVED cannot sign in — treat them as
    // not-a-platform-user (the require* gates then redirect to /login). Scoped
    // roles only; super_admin/l3_support have a null companyId and are never
    // blocked (they operate the platform, including un-archiving).
    if (platformUser.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: platformUser.companyId },
        select: { status: true },
      });
      if (company?.status === "ARCHIVED") return null;
    }

    return platformUser;
  },
);
