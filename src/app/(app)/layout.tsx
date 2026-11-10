import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { mfaRedirectTarget } from "@/lib/auth/mfa";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";

// Authenticated-app gate (SLD_RESTRUCTURE_PLAN_platform-modules.md §5). This
// layout now only guards "signed in at all" — the chrome lives one level down,
// split into two route groups so the P2 migration can proceed one module per
// commit without ever double-wrapping or breaking a page:
//   - (app)/app/(legacy)/  → AppHeader + present shell (pages not yet migrated)
//   - (app)/app/(shell)/   → the registry-driven sidebar shell (migrated pages)
// Both groups are path-transparent, so URLs are unaffected by the grouping.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireAuthenticatedUser();
  // P13 §4: once MFA is enforced, a high-privilege/health role without a
  // completed second factor is sent to enrol/step up before any app surface.
  const mfaTarget = await mfaRedirectTarget(user);
  if (mfaTarget) redirect(mfaTarget);
  return (
    <>
      <ImpersonationBanner />
      {children}
    </>
  );
}
