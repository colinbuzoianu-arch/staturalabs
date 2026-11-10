"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getSecurityDictionary } from "@/lib/i18n/dictionaries/security";
import type { Locale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/client";

// P13 §4 MFA enrolment / step-up. Client-only because Supabase MFA enrol /
// challenge / verify run against the user's own session in the browser. On
// mount it decides mode: a verified TOTP factor already exists -> "challenge"
// (enter a code to reach aal2); otherwise "enroll" (show a QR, then verify).
// On success the session is aal2 and we return to the app.
type Mode = "loading" | "enroll" | "challenge" | "done";

export function MfaEnrollClient({ locale }: { locale: Locale }) {
  const dict = getSecurityDictionary(locale);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = (factors?.totp ?? []).find(
        (f) => f.status === "verified",
      );
      if (verified) {
        setFactorId(verified.id);
        setMode("challenge");
        return;
      }
      // Enrol a fresh TOTP factor. Clean up any half-finished unverified one
      // first so repeated visits don't pile up factors.
      for (const f of factors?.totp ?? []) {
        if (f.status !== "verified")
          await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (enrollError || !data) {
        setError(dict.errorEnroll);
        setMode("enroll");
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setMode("enroll");
    })();
  }, [dict.errorEnroll]);

  const verify = useCallback(async () => {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setError(dict.errorGeneric);
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError(dict.errorGeneric);
      setBusy(false);
      return;
    }
    setMode("done");
    // The session is now aal2; refresh so the shell gate lets us through.
    router.push("/app");
    router.refresh();
  }, [factorId, code, dict.errorGeneric, router]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  if (mode === "loading") return <p className="text-sm">{dict.loading}</p>;
  if (mode === "done") return <p className="text-sm">{dict.success}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        {mode === "enroll" ? dict.enrollIntro : dict.challengeIntro}
      </p>

      {mode === "enroll" && qrCode && (
        <div className="flex flex-col gap-2">
          {/* Supabase returns the QR as an SVG data URL. */}
          {/** biome-ignore lint/performance/noImgElement: static data-URL QR, not a remote asset */}
          <img
            src={qrCode}
            alt="TOTP QR code"
            width={200}
            height={200}
            className="rounded border bg-white p-2"
          />
          {secret && (
            <div className="flex flex-col text-xs">
              <span>{dict.secretLabel}</span>
              <code className="mt-1 break-all rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-800">
                {secret}
              </code>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col text-sm">
          {dict.codeLabel}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            required
            className="mt-1 w-40 rounded border px-2 py-1 tracking-widest"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy || code.trim().length < 6}
            className="rounded bg-black px-3 py-1 text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {busy ? dict.verifying : dict.verifyButton}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm underline"
          >
            {dict.signOut}
          </button>
        </div>
      </form>
    </div>
  );
}
