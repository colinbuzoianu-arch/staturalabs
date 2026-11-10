import { MfaEnrollClient } from "@/components/mfa-enroll-client";
import { requireAuthenticatedUser } from "@/lib/auth/require-access";
import { getSecurityDictionary } from "@/lib/i18n/dictionaries/security";
import { getLocale } from "@/lib/i18n/get-locale";

// P13 §4 MFA enrol / step-up surface. Deliberately OUTSIDE the (app) route group
// so the shell's MFA gate can redirect here without a loop. Requires a signed-in
// platform user (no role restriction — a required role is sent here by the gate;
// anyone else who lands here can still add a factor voluntarily).
export default async function MfaPage() {
  await requireAuthenticatedUser();
  const locale = await getLocale();
  const dict = getSecurityDictionary(locale);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">{dict.heading}</h1>
      <MfaEnrollClient locale={locale} />
    </div>
  );
}
