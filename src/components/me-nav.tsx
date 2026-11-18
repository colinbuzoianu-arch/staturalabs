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
