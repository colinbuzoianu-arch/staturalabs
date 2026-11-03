// P5 notifications service (SLD_RESTRUCTURE_PLAN_platform-modules.md §7.9):
// "Email through one provider abstraction with EU sending." This is that one
// seam. No provider is wired in this environment, so when unconfigured it is
// a logged no-op that NEVER throws and NEVER blocks the in-app notification
// (same fail-safe, pluggable posture as src/lib/storage/malware-scan.ts's
// external-engine hook). A real provider (e.g. an EU-region transactional
// email API) is configured later via NOTIFICATION_EMAIL_URL; the recipient's
// address is a PlatformUser login email (§3.18(4)), never a worker's.

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "no-provider" | "no-recipient" | "error" };

export type NotificationEmail = {
  to: string | null;
  subject: string;
  body: string;
};

// The EU-sending contract: the provider endpoint is expected to be hosted in
// the EU. We pass that expectation along as a header so a misconfigured
// non-EU endpoint is at least auditable; it does not by itself guarantee
// region, which is a deployment/config concern verified out of band.
const PROVIDER_URL = process.env.NOTIFICATION_EMAIL_URL;

export async function sendNotificationEmail(
  email: NotificationEmail,
): Promise<SendEmailResult> {
  if (!email.to) return { sent: false, reason: "no-recipient" };

  if (!PROVIDER_URL) {
    // Unconfigured: the in-app notification is the system of record; email is
    // an optional best-effort channel. Log and move on.
    console.info(
      `[notifications] email provider not configured; skipping email to ${email.to} (${email.subject})`,
    );
    return { sent: false, reason: "no-provider" };
  }

  try {
    const res = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sending-region": "eu",
      },
      body: JSON.stringify({
        to: email.to,
        subject: email.subject,
        body: email.body,
      }),
    });
    if (!res.ok) {
      console.warn(
        `[notifications] email provider returned ${res.status} for ${email.to}`,
      );
      return { sent: false, reason: "error" };
    }
    return { sent: true };
  } catch (error) {
    console.warn(`[notifications] email dispatch failed: ${String(error)}`);
    return { sent: false, reason: "error" };
  }
}
