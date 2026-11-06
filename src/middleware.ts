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
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  // P13 §2.4: read-only impersonation. While the impersonation cookie is set,
  // block every mutating request to the app/API surface — the super_admin is
  // viewing a tenant "as" its admin and may not write. The stop endpoint is a
  // GET, so it is never caught here. The cookie is only honoured (for the
  // effective user) when the real user is super_admin, so its mere presence for
  // anyone else just makes their own session read-only — never an escalation.
  if (
    request.cookies.get("sld-impersonate") &&
    MUTATING_METHODS.has(request.method)
  ) {
    const p = request.nextUrl.pathname;
    if (p.startsWith("/app") || p.startsWith("/api")) {
      return NextResponse.json(
        { error: "Read-only: an impersonation session is active." },
        { status: 403 },
      );
    }
  }

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
  matcher: [
    "/at",
    "/at/:path*",
    "/de",
    "/de/:path*",
    "/ch",
    "/ch/:path*",
    // P13 §2.4: so the impersonation read-only block sees app/API mutations.
    "/app/:path*",
    "/api/:path*",
  ],
};
