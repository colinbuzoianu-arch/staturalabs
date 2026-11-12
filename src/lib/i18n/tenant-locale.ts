import "server-only";

import { getCurrentPlatformUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { isLocale, type Locale } from "./locale";

// The signed-in user's tenant default UI language, if a super-admin set one.
// Used by getLocale as the fallback BEFORE the hard-coded DEFAULT_LOCALE, so a
// new user of e.g. a Romanian customer sees Romanian until they pick their own
// language (which is then stored in the cookie and wins). Fails open to null
// for unauthenticated/marketing contexts or any lookup error — never throws
// into a render.
export async function getTenantDefaultLocale(): Promise<Locale | null> {
  try {
    const user = await getCurrentPlatformUser();
    if (!user?.companyId) return null;
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { defaultLocale: true },
    });
    return isLocale(company?.defaultLocale) ? company.defaultLocale : null;
  } catch {
    return null;
  }
}
