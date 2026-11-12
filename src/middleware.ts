import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// P13 §2.4: read-only impersonation. While the impersonation cookie is set,
// block every mutating request to the app/API surface — the super_admin is
// viewing a tenant "as" its admin and may not write. The stop endpoint is a
// GET, so it is never caught here. The cookie is only honoured (for the
// effective user) when the real user is super_admin, so its mere presence for
// anyone else just makes their own session read-only — never an escalation.
//
// (The earlier /[country] marketing locale-cookie logic was removed with the
// country-chooser restructure: the marketing site is now a single German-
// default site with an EN/RO switcher, no country URL segments.)
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*"],
};
