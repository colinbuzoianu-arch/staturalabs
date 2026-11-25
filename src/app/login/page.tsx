"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLoginDictionary } from "@/lib/i18n/dictionaries/login";
import { useLocale } from "@/lib/i18n/locale-context";
import { EMPLOYEE_PASSWORD_MIN_LENGTH } from "@/lib/people/employee-password";
import { createClient } from "@/lib/supabase/client";

// Minimal login page — deliberately no sign-up/create-account link anywhere
// here: accounts are invite-provisioned only (see CLAUDE.md,
// src/lib/auth/invite.ts) and there is no public self-service registration
// path in this app. Also no password reset or magic link — email/password
// sign-in only. Always on the teal brand surface, regardless of the
// dashboard's dark/light theme toggle — there's no toggle here at all,
// per the design spec.
//
// P17 §5 adds a SECOND path for employees with no company e-mail: personnel
// number + a one-time access code handed over on a printed sheet, which sets
// their own password via POST /api/auth/access-code and then signs in through
// the exact same signInWithPassword call as everyone else. Still not a
// sign-up: the account was provisioned by an admin, the code only claims it.
type Mode = "email" | "access-code";

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const dict = getLoginDictionary(locale);
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [personnelNumber, setPersonnelNumber] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signIn(withEmail: string, withPassword: string) {
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: withEmail,
      password: withPassword,
    });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/app");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    // Deliberately wrapped: signInWithPassword returning a `{ error }`
    // object only covers Supabase-reported auth failures. Anything else
    // (createClient() throwing on a missing env var, a network failure,
    // the browser storage adapter throwing) is a plain thrown exception
    // that would otherwise leave this handler failing silently — no
    // message shown, submitting stuck true forever.
    try {
      await signIn(email, password);
    } catch (err) {
      console.error("Sign-in failed:", err);
      setError(
        err instanceof Error ? err.message : "Sign-in failed unexpectedly.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccessCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== newPasswordRepeat) {
      setError(dict.passwordsDoNotMatch);
      return;
    }
    if (newPassword.length < EMPLOYEE_PASSWORD_MIN_LENGTH) {
      setError(
        dict.passwordTooShort.replace(
          "{min}",
          String(EMPLOYEE_PASSWORD_MIN_LENGTH),
        ),
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personnelNumber,
          code: accessCode,
          newPassword,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          body.error === "weak-password"
            ? dict.passwordTooShort.replace(
                "{min}",
                String(EMPLOYEE_PASSWORD_MIN_LENGTH),
              )
            : dict.accessCodeInvalid,
        );
        return;
      }
      const { email: resolvedEmail } = (await response.json()) as {
        email: string;
      };
      await signIn(resolvedEmail, newPassword);
    } catch (err) {
      console.error("Access-code activation failed:", err);
      setError(
        err instanceof Error ? err.message : "Sign-in failed unexpectedly.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "rounded-md border border-sage-dark bg-transparent px-3 py-2 text-ivory placeholder:text-sage-dark focus:border-coral focus:outline-none";

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-10 bg-teal px-6 py-16 text-ivory">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>

      <Image
        src="/logo/statura_logo_main.svg"
        alt="Statura Labs Dynamics"
        width={260}
        height={279}
        unoptimized
        priority
      />

      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex gap-2 text-xs" role="tablist">
          {(["email", "access-code"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-md px-3 py-1.5 font-technical uppercase tracking-wider transition-opacity ${
                mode === m
                  ? "bg-ivory/15 text-ivory"
                  : "text-sage-dark hover:opacity-80"
              }`}
            >
              {m === "email" ? dict.modeEmail : dict.modeAccessCode}
            </button>
          ))}
        </div>

        {mode === "email" ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              {dict.emailLabel}
              <input
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {dict.passwordLabel}
              <input
                type="password"
                required
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </label>

            {error && <p className="text-sm text-coral">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-md bg-coral px-4 py-2 font-heading font-bold text-teal transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? dict.signingIn : dict.signIn}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleAccessCodeSubmit}
            className="flex flex-col gap-4"
          >
            <p className="text-xs text-sage-dark">{dict.accessCodeIntro}</p>

            <label className="flex flex-col gap-1 text-sm">
              {dict.personnelNumberLabel}
              <input
                required
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                value={personnelNumber}
                onChange={(e) => setPersonnelNumber(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {dict.accessCodeLabel}
              <input
                required
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className={`${inputClass} font-technical tracking-widest`}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {dict.newPasswordLabel}
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
              <span className="text-xs text-sage-dark">
                {dict.newPasswordHint.replace(
                  "{min}",
                  String(EMPLOYEE_PASSWORD_MIN_LENGTH),
                )}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              {dict.newPasswordRepeatLabel}
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPasswordRepeat}
                onChange={(e) => setNewPasswordRepeat(e.target.value)}
                className={inputClass}
              />
            </label>

            {error && <p className="text-sm text-coral">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-md bg-coral px-4 py-2 font-heading font-bold text-teal transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? dict.activating : dict.activateAndSignIn}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
