"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { useLocale } from "@/lib/i18n/locale-context";
import { ThemeToggle } from "./theme-toggle";

const STORAGE_KEY = "statura-theme";

// The badge SVGs each carry their own opaque background rect (teal for
// on_dark, ivory for on_light) rather than transparency, so the logo has to
// track the active theme to blend into the header instead of sitting on it
// as a mismatched patch — same theme state drives both the badge and the
// toggle button, read from the DOM attribute the inline init script (root
// layout.tsx) already set before this component mounts.
//
// showAdministrationLink is resolved server-side by the caller
// ((app)/layout.tsx, via requireAuthenticatedUser's role) rather than
// re-deriving role logic here — this component has no access to the
// current user itself.
export function AppHeader({
  showAdministrationLink = false,
}: {
  showAdministrationLink?: boolean;
}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { locale } = useLocale();
  const dict = getCommonDictionary(locale);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
    setTheme(next);
  }

  const badgeSrc =
    theme === "dark"
      ? "/logo/statura_logo_on_dark.svg"
      : "/logo/statura_logo_on_light.svg";

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4">
      <Link href="/sites" className="flex items-center gap-3">
        <Image
          src={badgeSrc}
          alt="Statura Labs Dynamics"
          width={40}
          height={40}
          className="size-10 shrink-0"
          unoptimized
          priority
        />
        {/* Collapses to badge-only below sm, per the design spec. Logotype
            mark only — never prose like "SLD Dashboard". */}
        <span className="hidden font-wordmark text-sm tracking-wide text-foreground sm:inline">
          STATURA LABS DYNAMICS
        </span>
      </Link>
      <div className="flex items-center gap-4 text-foreground">
        {showAdministrationLink && (
          <Link href="/administration" className="text-sm hover:text-accent">
            {dict.nav.administration}
          </Link>
        )}
        <LanguageSwitcher />
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
    </header>
  );
}
