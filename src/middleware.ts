import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isMarketingCountry } from "@/lib/country/countries";
import { getCountryPack } from "@/lib/country/packs";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/locale";

// The one job of this middleware: visiting a /[country] marketing route
// sets the locale cookie to that market's default language, but only if
// no locale cookie exists yet — an explicit language choice always wins
// and this must never overwrite one
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.2). Server Components can
// only read cookies, not set them (next/headers `cookies().set()` is
// Server-Action/Route-Handler only), so this has to happen here rather
// than in (marketing)/[country]/layout.tsx.
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(existing)) {
    return NextResponse.next();
  }

  const [, country] = request.nextUrl.pathname.split("/");
  if (!country || !isMarketingCountry(country)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(LOCALE_COOKIE, getCountryPack(country).defaultLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/at", "/at/:path*", "/de", "/de/:path*", "/ch", "/ch/:path*"],
};
