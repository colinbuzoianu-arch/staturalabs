"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/components/ui/cn";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { useLocale } from "@/lib/i18n/locale-context";
import { createClient } from "@/lib/supabase/client";

// Shared sign-out control. Clears the Supabase session (cookie-based ssr
// client) and routes to /login. Used in both shells (app sidebar + admin
// console). `variant` picks the surface: a full-width sidebar row, or a
// compact header button.
export function LogoutButton({
  variant = "button",
  collapsed = false,
  className,
}: {
  variant?: "button" | "sidebar-row";
  collapsed?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const label = getCommonDictionary(locale).nav.signOut;
  const [busy, setBusy] = useState(false);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Even if the network sign-out fails, send them to /login — the
      // middleware re-gates and a stale cookie is cleared on next sign-in.
    }
    router.push("/login");
    router.refresh();
  }, [router]);

  if (variant === "sidebar-row") {
    return (
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground disabled:opacity-50",
          collapsed && "justify-center px-0",
          className,
        )}
      >
        <LogOut size={18} aria-hidden className="shrink-0" />
        {!collapsed ? (
          <span className="flex-1 truncate text-left">{label}</span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border px-3 py-1.5 text-sm text-foreground-muted hover:border-border-strong hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      <LogOut size={16} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
