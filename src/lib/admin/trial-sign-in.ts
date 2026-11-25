import "server-only";

import { recordAuditEvent } from "@/lib/audit/audit-event";
import { trialNotifyAddress } from "@/lib/config/contact";
import { sendNotificationEmail } from "@/lib/notifications/email";
import { prisma } from "@/lib/prisma";

// P18 A.5: "A new trial sign-in sends an email to the founder (first login of
// the trial admin)."
//
// Stamped once on Company.trialFirstSignInAt, with a conditional update as the
// idempotency guard: `updateMany` with `trialFirstSignInAt: null` in the WHERE
// means two concurrent first requests cannot both send the mail — the second
// one updates zero rows and does nothing. That matters because this runs in a
// layout, i.e. on every request until it has fired.
export async function noteTrialFirstSignIn(
  companyId: string,
  companyName: string,
): Promise<void> {
  try {
    const stamped = await prisma.company.updateMany({
      where: { id: companyId, trialFirstSignInAt: null, tenantKind: "TRIAL" },
      data: { trialFirstSignInAt: new Date() },
    });
    if (stamped.count === 0) return; // someone else got there first

    await recordAuditEvent({
      actorUserId: null,
      action: "trial.first_sign_in",
      entityType: "Company",
      entityId: companyId,
      companyId,
    });

    const to = trialNotifyAddress();
    if (!to) return;
    await sendNotificationEmail({
      to,
      subject: `Testzugang ${companyName}: erste Anmeldung`,
      body: `Im Testzugang ${companyName} hat sich erstmals jemand angemeldet.`,
    });
  } catch (error) {
    // Never let the founder's courtesy notification break a prospect's first
    // page view.
    console.warn(`[trial] first-sign-in notice failed: ${String(error)}`);
  }
}
