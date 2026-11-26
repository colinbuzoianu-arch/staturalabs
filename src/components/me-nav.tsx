"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// P17 §5: the employee self-service tab bar. A SELF-scoped employee has no site
// sidebar (the /app/me layout falls back to header chrome), so this is their
// only in-page navigation. The employee tabs render only when the account is
// linked to a Person (hasPerson); otherwise just the overview link shows, so an
// admin who opens /app/me isn't offered empty employee surfaces.
export type MeNavLabels = {
  navOverview: string;
  navInstructions: string;
  navDocuments: string;
  navIncidents: string;
  // Sicherheitsinformationen: shown to EVERY account, person-linked or not —
  // a role audience addresses accounts directly.
  navBroadcasts: string;
  // The handbook, filtered to this role. Shown to EVERY account: a SELF-scoped
  // employee has no accessible site, so the site-scoped Hilfe 404s for them and
  // this is their only way into it.
  navHelp: string;
};

export function MeNav({
  labels,
  hasPerson,
}: {
  labels: MeNavLabels;
  hasPerson: boolean;
}) {
  const pathname = usePathname();
  const tabs: { href: string; label: string }[] = [
    { href: "/app/me", label: labels.navOverview },
    { href: "/app/me/broadcasts", label: labels.navBroadcasts },
    { href: "/app/me/help", label: labels.navHelp },
  ];
  if (hasPerson) {
    tabs.push(
      { href: "/app/me/instructions", label: labels.navInstructions },
      { href: "/app/me/documents", label: labels.navDocuments },
      { href: "/app/me/incidents", label: labels.navIncidents },
    );
  }

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3 text-sm">
      {tabs.map((t) => {
        const active =
          t.href === "/app/me" ? pathname === "/app/me" : pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              active
                ? "rounded-[var(--radius-md)] bg-surface-raised px-3 py-1 font-medium text-foreground"
                : "rounded-[var(--radius-md)] px-3 py-1 text-foreground-muted hover:bg-surface-raised"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
