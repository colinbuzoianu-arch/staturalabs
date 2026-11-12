import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";
import { getTenantDefaultLocale } from "./tenant-locale";

// Reads the saved-language cookie for the current request. `cache()`
// memoizes it per request/render pass, same pattern as
// getCurrentPlatformUser (src/lib/auth/current-user.ts) — every Server
// Component page calls this independently to render its own text in the
// right language (Context can't cross the server/client boundary, so the
// root layout's LocaleProvider, for client components, doesn't help pages
// render server-side).
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;
  // An explicit per-user choice (cookie) always wins. Otherwise fall back to
  // the user's tenant default language (super-admin set), then DEFAULT_LOCALE.
  if (isLocale(value)) return value;
  return (await getTenantDefaultLocale()) ?? DEFAULT_LOCALE;
});
