import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BroadcastAlertBanner } from "@/components/broadcast-alert-banner";
import { BroadcastBlockingCard } from "@/components/broadcast-blocking-card";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { TrialBand } from "@/components/trial-band";
import { TrialExpiredCard } from "@/components/trial-expired-card";
import { noteTrialFirstSignIn } from "@/lib/admin/trial-sign-in";
import { mfaRedirectTarget } from "@/lib/auth/mfa";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { listOutstandingForUser } from "@/lib/broadcasts/my-broadcasts";
import { trialContactMailto } from "@/lib/config/contact";
import { getAdministrationDictionary } from "@/lib/i18n/dictionaries/administration";
import { getLocale } from "@/lib/i18n/get-locale";
import { prisma } from "@/lib/prisma";

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
  const locale = await getLocale();
  const administration = getAdministrationDictionary(locale);
  const broadcastDict = administration.broadcasts;

  // P18 A.3: a trial tenant carries its band on every page — what this tenant
  // is, when it ends, how to reach a human, and the honest note about real
  // personal data. Resolved here, once, next to the other bands. A customer
  // tenant costs one indexed lookup and renders nothing.
  const company = user.companyId
    ? await prisma.company.findUnique({
        where: { id: user.companyId },
        select: {
          name: true,
          tenantKind: true,
          trialExpiresAt: true,
          trialLockedAt: true,
          trialFirstSignInAt: true,
        },
      })
    : null;

  // A.4: a LOCKED trial shows a closed door instead of the app. The data is
  // still there (the grace period is running), so this is not a deletion
  // notice — and it is checked here, in the one authenticated gate, so no
  // route can be a way around it.
  if (company?.tenantKind === "TRIAL" && company.trialLockedAt) {
    return (
      <TrialExpiredCard
        companyName={company.name}
        contactHref={trialContactMailto(company.name)}
        labels={{
          heading: administration.trial.expiredHeading,
          body: administration.trial.expiredBody,
          contact: administration.trial.expiredContact,
        }}
      />
    );
  }

  // A.5: the founder hears once when a trial actually starts being used. Fire
  // and forget — a failed notification must never block the page.
  if (
    company?.tenantKind === "TRIAL" &&
    company.trialFirstSignInAt === null &&
    user.companyId
  ) {
    await noteTrialFirstSignIn(user.companyId, company.name);
  }
  const trialBand =
    company?.tenantKind === "TRIAL"
      ? {
          expiresLabel:
            company.trialExpiresAt?.toLocaleDateString(locale) ?? "—",
          contactHref: trialContactMailto(company.name),
        }
      : null;

  // An access-code account (P17 §5) has no deliverable e-mail address, so no
  // mail reminder can reach them at all. For those accounts an outstanding
  // confirmation BLOCKS the app at their next sign-in rather than sitting in a
  // banner they can scroll past — the only channel that actually reaches a
  // worker without e-mail. The card links straight to /app/me/broadcasts/[id],
  // which renders under this same layout but passes the check once nothing is
  // outstanding, so it is never a dead end: confirming clears it.
  //
  // Only the alerts are banner material, and the banner is mounted below ONLY
  // when that list is non-empty: a mounted client component serialises its
  // label props into every page's RSC payload, so an always-mounted
  // return-null banner would ship its strings to every page for nothing.
  const alerts = outstanding
    .filter((b) => b.priority === "SAFETY_ALERT")
    .map((b) => ({
      broadcastId: b.broadcastId,
      title: b.title,
      requiresConfirmation: b.requiresConfirmation,
    }));

  const blocking =
    user.email.endsWith("@employee.sld.invalid") && outstanding.length > 0;

  if (blocking) {
    return (
      <BroadcastBlockingCard
        items={outstanding.map((b) => ({
          broadcastId: b.broadcastId,
          title: b.title,
        }))}
        labels={{
          title: broadcastDict.blockingTitle,
          intro: broadcastDict.blockingIntro,
          action: broadcastDict.confirmButton,
        }}
      >
        {children}
      </BroadcastBlockingCard>
    );
  }

  return (
    <>
      <ImpersonationBanner />
      {trialBand && (
        <TrialBand
          expiresLabel={trialBand.expiresLabel}
          contactHref={trialBand.contactHref}
          labels={administration.trial.band}
        />
      )}
      {alerts.length > 0 && (
        <BroadcastAlertBanner
          items={alerts}
          labels={{
            title: broadcastDict.alertBannerTitle,
            action: broadcastDict.alertBannerAction,
            dismiss: broadcastDict.alertBannerDismiss,
          }}
        />
      )}
      {children}
    </>
  );
}
