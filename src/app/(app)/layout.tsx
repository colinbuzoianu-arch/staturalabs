import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BroadcastAlertBanner } from "@/components/broadcast-alert-banner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { mfaRedirectTarget } from "@/lib/auth/mfa";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { listOutstandingForUser } from "@/lib/broadcasts/my-broadcasts";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";

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

  // Sicherheitsinformationen: an unconfirmed SAFETY_ALERT (or any outstanding
  // confirmation) shows above every authenticated page — mounted HERE, once,
  // rather than per module, so no surface can be a hiding place from it. One
  // query per render, scoped to this user's own recipient rows.
  const outstanding = await listOutstandingForUser(user);
  const broadcastDict = getAdministrationDictionary(
    await getLocale(),
  ).broadcasts;

  return (
    <>
      <ImpersonationBanner />
      <BroadcastAlertBanner
        items={outstanding
          .filter((b) => b.priority === "SAFETY_ALERT")
          .map((b) => ({
            broadcastId: b.broadcastId,
            title: b.title,
            requiresConfirmation: b.requiresConfirmation,
          }))}
        labels={{
          title: broadcastDict.alertBannerTitle,
          action: broadcastDict.alertBannerAction,
          dismiss: broadcastDict.alertBannerDismiss,
        }}
      />
      {children}
    </>
  );
}
