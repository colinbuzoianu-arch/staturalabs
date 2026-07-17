import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client, for Client Components (e.g. the login
// form). There is no sign-up form to pair it with — accounts are
// invite-provisioned only, see `../auth/invite.ts`.
//
// NEXT_PUBLIC_* vars must be referenced as static `process.env.X` literals
// right here, not through a helper that does `process.env[name]` (like
// `@/lib/env`'s requireEnv) — Next.js only inlines NEXT_PUBLIC_ vars into
// the client bundle when it can see the exact property access at build
// time. A dynamic lookup always evaluates to undefined in the browser
// (there's no real `process.env` there), even though the var is genuinely
// set in `.env` — that's what broke the login page: requireEnv works fine
// in server.ts (real Node process.env, no inlining needed) but silently
// failed here.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
