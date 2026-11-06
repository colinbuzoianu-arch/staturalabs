import { PlatformRole } from "@/generated/prisma/enums";
import {
  getCurrentPlatformUser,
  getRealPlatformUser,
} from "@/lib/auth/current-user";
import { getImpersonationTargetId } from "@/lib/auth/impersonation";
import { getAdminDictionary } from "@/lib/i18n/dictionaries/admin";
import { getLocale } from "@/lib/i18n/get-locale";

// P13 §2.4: a persistent banner shown across the (app) surface while a
// super_admin is impersonating a tenant user, read-only. The stop control is a
// GET (never caught by the read-only middleware block).
export async function ImpersonationBanner() {
  const real = await getRealPlatformUser();
  if (!real || real.role !== PlatformRole.SUPER_ADMIN) return null;
  const targetId = await getImpersonationTargetId();
  if (!targetId || targetId === real.id) return null;
  const effective = await getCurrentPlatformUser();
  if (!effective || effective.id === real.id) return null;

  const locale = await getLocale();
  const dict = getAdminDictionary(locale).impersonation;

  return (
    <div className="flex items-center justify-between gap-4 bg-status-high px-4 py-2 text-sm text-white">
      <span>
        {dict.banner
          .replace("{name}", effective.name)
          .replace("{email}", effective.email)}
      </span>
      <a
        href="/impersonate/stop"
        className="rounded border border-white/60 px-3 py-1 font-medium hover:bg-white/10"
      >
        {dict.stop}
      </a>
    </div>
  );
}
