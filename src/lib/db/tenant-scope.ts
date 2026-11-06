import "server-only";

import { prisma } from "@/lib/prisma";

// P13 §1: the runtime seam for RLS tenant scoping. When the runtime connects as
// the non-owning `statura_app` role (the staging rollout — SLD_P13_RLS_ROLLOUT.md),
// each request must declare which companies the session may see by setting the
// `app.company_ids` GUC; the RLS policies then enforce isolation at the DB level
// as defence in depth behind the app's require*Access checks.
//
// Flag-gated: with RLS_ENFORCED unset/false (today's default, owner-connected
// runtime), this is a no-op passthrough — nothing changes. Enabling it is a
// deliberate staging step, not flipped casually.

export function isRlsEnforced(): boolean {
  return process.env.RLS_ENFORCED === "true";
}

// Run `fn` with the session scoped to the given company ids. Under enforcement,
// wraps the work in a transaction that sets `app.company_ids` transaction-local
// (SET LOCAL via set_config(..., true)), so the policies see it on the same
// connection. Without enforcement, runs `fn` directly against the shared client.
export async function withCompanyScope<T>(
  companyIds: readonly string[],
  fn: (tx: typeof prisma) => Promise<T>,
): Promise<T> {
  if (!isRlsEnforced()) {
    return fn(prisma);
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.company_ids', ${companyIds.join(",")}, true)`;
    return fn(tx as unknown as typeof prisma);
  });
}
