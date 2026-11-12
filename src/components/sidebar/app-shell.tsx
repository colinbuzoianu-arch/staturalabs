"use client";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { PresentModeExitBar } from "@/components/present-mode-exit-bar";
import { resolveModuleLabel } from "@/lib/modules/module-labels";
import type { BadgeSource } from "@/lib/modules/registry";
import { MODULE_REGISTRY, type ModuleKey } from "@/lib/modules/registry";
import { isPresentMode } from "@/lib/present-mode";
import { AppSidebar, type SidebarSite } from "./app-sidebar";

const COLLAPSE_KEY = "sld-sidebar-collapsed";

// The site-scoped app shell (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.1).
// Client component so it can read the active route (usePathname), the present
// flag (useSearchParams) and the persisted collapse state. The server layout
// hands it only serialisable data (siteId, the enabled/migrated module keys,
// badge counts); the registry's route builders and labels run here on the
// client via import, so no function crosses the server→client boundary.
//
// Present mode reuses the exact no-Suspense pattern as PresentModeShell: the
// sidebar is simply not rendered when ?present=1, so the walkthrough views
// stay chrome-free. Mobile (<1024px) collapses the sidebar into a drawer.
export function AppShell({
  siteId,
  enabledKeys,
  sites = [],
  badges,
  exitLabel,
  children,
}: {
  siteId: string;
  enabledKeys: readonly ModuleKey[];
  sites?: readonly SidebarSite[];
  badges: Partial<Record<BadgeSource, number>>;
  exitLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const present = isPresentMode(searchParams.get("present") ?? undefined);

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Seed collapse state from localStorage after mount (avoids a hydration
  // mismatch — SSR always renders expanded).
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const enabled = new Set(enabledKeys);
  const modules = MODULE_REGISTRY.filter((m) => enabled.has(m.key));
  const activeKey = resolveActiveKey(pathname, siteId, modules);

  if (present) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-lg text-foreground contrast-125 [&_h1]:text-4xl [&_h2]:text-2xl">
        <main className="flex-1 px-6 py-10">{children}</main>
        <PresentModeExitBar exitLabel={exitLabel} />
      </div>
    );
  }

  const sidebar = (
    <AppSidebar
      modules={modules}
      activeKey={activeKey}
      siteId={siteId}
      sites={sites}
      collapsed={collapsed}
      badges={badges}
      t={resolveModuleLabel}
      onToggleCollapse={toggleCollapse}
    />
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop: fixed full-height sidebar */}
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        {sidebar}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile: top bar with menu button */}
        <div className="flex h-12 items-center gap-3 border-b border-border px-3 lg:hidden">
          <button
            type="button"
            aria-label="Menü öffnen"
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] border border-border"
          >
            ☰
          </button>
          <Image
            src="/logo/statura_logo_on_dark.svg"
            alt=""
            aria-hidden
            width={28}
            height={28}
            unoptimized
            className="h-7 w-7 rounded-[var(--radius-sm)]"
          />
          <span className="font-[family-name:var(--font-wordmark)] text-sm font-semibold">
            STATURA LABS DYNAMICS
          </span>
        </div>
        <main className="flex-1 px-5 py-6 lg:px-8">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">{sidebar}</div>
          <button
            type="button"
            aria-label="Menü schließen"
            className="h-full flex-1 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

// Longest-prefix match: the cockpit's base (/app/s/[siteId]) is a prefix of
// every site-scoped path, so the most specific module whose base path matches
// wins. Falls back to the first module when nothing matches.
function resolveActiveKey(
  pathname: string,
  siteId: string,
  modules: ReadonlyArray<(typeof MODULE_REGISTRY)[number]>,
): ModuleKey {
  let best: ModuleKey | null = null;
  let bestLen = -1;
  for (const m of modules) {
    const base = m.basePath(siteId);
    if (
      (pathname === base || pathname.startsWith(`${base}/`)) &&
      base.length > bestLen
    ) {
      best = m.key;
      bestLen = base.length;
    }
  }
  return best ?? modules[0]?.key;
}
