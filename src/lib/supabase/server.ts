import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

// Server-side Supabase client for Server Components, Server Actions, and
// Route Handlers. Reads/writes the auth session via cookies. There is no
// public sign-up flow anywhere in this app — every platform_user account is
// created through the invite-only provisioning path in `./invite.ts`.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Called from a Server Component when only reading the session is
          // possible; setting throws there and is safe to ignore because
          // Proxy-level session refresh (once added) covers that case.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {}
        },
      },
    },
  );
}

// Admin client using the service-role key — bypasses RLS. Never expose to
// the client, only use in trusted server-only code (e.g. the invite flow).
export function createAdminClient() {
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}
