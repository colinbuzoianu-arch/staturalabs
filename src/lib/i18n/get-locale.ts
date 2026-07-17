import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locale";

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
  return isLocale(value) ? value : DEFAULT_LOCALE;
});
