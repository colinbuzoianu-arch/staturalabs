import { prisma } from "@/lib/prisma";

// P13 §4 health surface. Unauthenticated, cheap liveness + DB-reachability probe
// for uptime monitoring and load-balancer checks. Returns 200 {ok:true} when the
// database answers a trivial query, 503 otherwise. Leaks nothing: no tenant data,
// no version/secret, just a boolean and a timestamp.
export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return Response.json(
      { ok: true, time: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
