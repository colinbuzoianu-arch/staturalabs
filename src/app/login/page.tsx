"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getLoginDictionary } from "@/lib/i18n/dictionaries/login";
import { useLocale } from "@/lib/i18n/locale-context";
import { createClient } from "@/lib/supabase/client";

// Minimal login page — deliberately no sign-up/create-account link anywhere
// here: accounts are invite-provisioned only (see CLAUDE.md,
// src/lib/auth/invite.ts) and there is no public self-service registration
// path in this app. Also no password reset or magic link — email/password
// sign-in only. Always on the teal brand surface, regardless of the
// dashboard's dark/light theme toggle — there's no toggle here at all,
// per the design spec.
export default function LoginPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const dict = getLoginDictionary(locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/sites");
    router.refresh();
  }

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

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          {dict.emailLabel}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-sage-dark bg-transparent px-3 py-2 text-ivory placeholder:text-sage-dark focus:border-coral focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {dict.passwordLabel}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-sage-dark bg-transparent px-3 py-2 text-ivory focus:border-coral focus:outline-none"
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
    </div>
  );
}
