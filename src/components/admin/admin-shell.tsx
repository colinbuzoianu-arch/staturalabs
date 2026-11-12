"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/components/ui/cn";

// Styled super-admin console shell. Replaces the bare underline-link nav the
// /admin tool shipped with — a real cross-tenant control panel (logo, brand
// header, tab nav) built on the same design tokens as the (app) sidebar so the
// two surfaces read as one product. The server layout resolves auth + MFA and
// hands this client component only serialisable nav data (it needs usePathname
// for the active tab).
export type AdminNavItem = { href: string; label: string };

export function AdminShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: readonly AdminNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Image
              src="/logo/statura_logo_on_dark.svg"
              alt=""
              aria-hidden
              width={34}
              height={34}
              unoptimized
              className="h-[34px] w-[34px] rounded-[var(--radius-md)]"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-[family-name:var(--font-wordmark)] text-sm font-semibold tracking-wide">
                STATURA LABS DYNAMICS
              </span>
              <span className="text-xs text-foreground-subtle">{title}</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </div>

        <nav
          aria-label="Super-Admin"
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4"
        >
          {nav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "border-accent font-medium text-foreground"
                    : "border-transparent text-foreground-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
