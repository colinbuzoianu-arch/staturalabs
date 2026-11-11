"use client";

import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import {
  type BadgeSource,
  MENU_GROUP_ORDER,
  type MenuGroup,
  type ModuleDefinition,
  ModuleKey,
  modulesInMenuOrder,
} from "@/lib/modules/registry";

// Registry-driven left sidebar (SLD_RESTRUCTURE_PLAN_platform-modules.md §5.1,
// §5.2). Presentational: it renders whatever modules it is handed, in registry
// order, with the active module's children expanded. The real shell (built
// after founder review) supplies the module list already filtered by
// entitlement + permission, the active key from usePathname, and the label
// resolver from i18n/country-pack. Nothing about the menu is hand-written per
// page — it all comes from the registry.
//
// Labels come through `t(labelKey)` so the shell can route them through the
// locale dictionary and the site's CountryPack (AT "Evaluierung" vs DE
// "Gefährdungsbeurteilung"); the proposal passes a German map.

// Nav badge colour by urgency type — gives the sidebar meaningful secondary
// colour (blue for your inbox, amber for upcoming training, red for overdue
// /open-incident pressure) rather than one coral count everywhere.
const BADGE_CLASS: Record<BadgeSource, string> = {
  "overdue-actions": "bg-status-high",
  "open-incidents": "bg-status-high",
  "open-my-tasks": "bg-info",
  "due-trainings": "bg-accent-secondary",
};

const GROUP_LABEL: Record<MenuGroup, string | null> = {
  overview: "ÜBERSICHT",
  assess: "BEURTEILEN",
  control: "STEUERN",
  evidence: "NACHWEISEN",
  system: null, // pinned to the bottom, no section header
};

export type SidebarSite = {
  id: string;
  name: string;
  country: string;
};

export type SidebarProps = {
  modules: readonly ModuleDefinition[];
  activeKey: ModuleKey;
  siteId: string;
  sites?: readonly SidebarSite[];
  collapsed?: boolean;
  badges?: Partial<Record<BadgeSource, number>>;
  t: (labelKey: string) => string;
  onToggleCollapse?: () => void;
};

export function AppSidebar({
  modules,
  activeKey,
  siteId,
  sites = [],
  collapsed = false,
  badges = {},
  t,
  onToggleCollapse,
}: SidebarProps) {
  const visible = new Set(modules.map((m) => m.key));
  const ordered = modulesInMenuOrder().filter((m) => visible.has(m.key));

  // The module the user is currently in, so switching site keeps them in the
  // same module rather than always dumping them at the cockpit.
  const activeModule = modules.find((m) => m.key === activeKey) ?? ordered[0];

  // Flat quick-nav index over the visible modules + their routed children,
  // built once per render. Labels go through `t` so search matches what the
  // user actually reads (locale/country-pack aware).
  const searchIndex = useMemo<SearchEntry[]>(
    () =>
      ordered.flatMap((m) => [
        { label: t(m.labelKey), href: m.basePath(siteId) },
        ...m.children.map((c) => ({
          label: `${t(m.labelKey)} · ${t(c.labelKey)}`,
          href: `${m.basePath(siteId)}/${c.slug}`,
        })),
      ]),
    [ordered, siteId, t],
  );

  const groups = MENU_GROUP_ORDER.map((g) => ({
    group: g,
    items: ordered.filter((m) => m.menuGroup === g),
  })).filter((g) => g.items.length > 0);

  const scrolling = groups.filter((g) => g.group !== "system");
  const system = groups.find((g) => g.group === "system");

  return (
    <nav
      aria-label="Hauptnavigation"
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface text-foreground",
        collapsed ? "w-16" : "w-[264px]",
      )}
    >
      <Brand collapsed={collapsed} />
      {!collapsed ? (
        <SiteSwitcher
          sites={sites}
          currentSiteId={siteId}
          hrefFor={(id) => {
            const base = activeModule?.basePath(id) ?? `/app/s/${id}`;
            // my-tasks/settings ignore siteId; fall back to the site cockpit so
            // a switch always lands on the chosen site.
            return base.startsWith("/app/s/") ? base : `/app/s/${id}`;
          }}
        />
      ) : null}
      {!collapsed ? (
        <SearchAndNew
          searchIndex={searchIndex}
          visibleKeys={visible}
          basePathFor={(key) =>
            modules.find((m) => m.key === key)?.basePath(siteId)
          }
        />
      ) : null}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {scrolling.map(({ group, items }) => (
          <Section key={group} label={collapsed ? null : GROUP_LABEL[group]}>
            {items.map((m) => (
              <Item
                key={m.key}
                def={m}
                active={m.key === activeKey}
                siteId={siteId}
                collapsed={collapsed}
                badge={m.badge ? badges[m.badge] : undefined}
                badgeClass={m.badge ? BADGE_CLASS[m.badge] : undefined}
                t={t}
              />
            ))}
          </Section>
        ))}
      </div>

      {system ? (
        <div className="border-t border-border px-2 py-2">
          {system.items.map((m) => (
            <Item
              key={m.key}
              def={m}
              active={m.key === activeKey}
              siteId={siteId}
              collapsed={collapsed}
              t={t}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-foreground-subtle hover:text-foreground"
      >
        <span aria-hidden>{collapsed ? "»" : "«"}</span>
        {!collapsed ? <span>Einklappen</span> : null}
      </button>
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-14 items-center gap-2 border-b border-border px-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-accent font-[family-name:var(--font-wordmark)] text-sm font-bold text-white">
        SLD
      </span>
      {!collapsed ? (
        <span className="font-[family-name:var(--font-wordmark)] text-sm font-semibold tracking-wide">
          STATURA LABS DYNAMICS
        </span>
      ) : null}
    </div>
  );
}

type SearchEntry = { label: string; href: string };

// Shared outside-click + Escape dismissal for the sidebar popovers. Returns a
// ref to attach to the popover root; clicking anywhere outside it, or pressing
// Escape, invokes onClose.
function useDismiss<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

const MENU_PANEL_CLASS =
  "absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-lg";

function SiteSwitcher({
  sites,
  currentSiteId,
  hrefFor,
}: {
  sites: readonly SidebarSite[];
  currentSiteId: string;
  hrefFor: (siteId: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const current = sites.find((s) => s.id === currentSiteId);

  return (
    <div ref={ref} className="relative mx-2 mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm hover:border-border-strong"
      >
        <span className="truncate text-left">
          <span className="text-foreground-subtle">Standort: </span>
          {current ? `${current.name} (${current.country})` : "—"}
        </span>
        <ChevronsUpDown
          size={16}
          aria-hidden
          className="shrink-0 text-foreground-subtle"
        />
      </button>

      {open ? (
        <div role="listbox" className={MENU_PANEL_CLASS}>
          {sites.length === 0 ? (
            <div className="px-3 py-2 text-sm text-foreground-subtle">
              Keine weiteren Standorte
            </div>
          ) : (
            sites.map((s) => {
              const isCurrent = s.id === currentSiteId;
              return (
                <Link
                  key={s.id}
                  href={hrefFor(s.id)}
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-raised",
                    isCurrent
                      ? "font-medium text-foreground"
                      : "text-foreground-muted",
                  )}
                >
                  <span className="truncate">
                    {s.name}{" "}
                    <span className="text-foreground-subtle">
                      ({s.country})
                    </span>
                  </span>
                  {isCurrent ? (
                    <Check
                      size={14}
                      aria-hidden
                      className="shrink-0 text-accent"
                    />
                  ) : null}
                </Link>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

// Quick-create shortcuts for the "+" menu. Each points at the page where the
// create form actually lives; only entries whose module is visible are shown,
// so the menu never links to a module the user can't see.
const NEW_ACTIONS: ReadonlyArray<{
  key: ModuleKey;
  label: string;
  slug?: string;
}> = [
  { key: ModuleKey.RISK, label: "Beurteilung starten", slug: "workstations" },
  { key: ModuleKey.INCIDENTS, label: "Ereignis melden", slug: "quick" },
  { key: ModuleKey.INSPECTIONS, label: "Begehung planen", slug: "planned" },
  { key: ModuleKey.ACTIONS, label: "Maßnahme erfassen" },
  { key: ModuleKey.CHEMICALS, label: "Gefahrstoff erfassen", slug: "register" },
];

function SearchAndNew({
  searchIndex,
  visibleKeys,
  basePathFor,
}: {
  searchIndex: readonly SearchEntry[];
  visibleKeys: ReadonlySet<ModuleKey>;
  basePathFor: (key: ModuleKey) => string | undefined;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const searchRef = useDismiss<HTMLDivElement>(searchOpen, closeSearch);

  const [newOpen, setNewOpen] = useState(false);
  const closeNew = useCallback(() => setNewOpen(false), []);
  const newRef = useDismiss<HTMLDivElement>(newOpen, closeNew);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchIndex
      .filter((e) => e.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, searchIndex]);

  const newItems = NEW_ACTIONS.flatMap((a) => {
    if (!visibleKeys.has(a.key)) return [];
    const base = basePathFor(a.key);
    if (!base) return [];
    return [{ label: a.label, href: a.slug ? `${base}/${a.slug}` : base }];
  });

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results[0]) {
      e.preventDefault();
      router.push(results[0].href);
      setSearchOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <div ref={searchRef} className="relative flex-1">
        <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle">
          <Icon name="search" size={16} />
        </div>
        <input
          type="search"
          value={query}
          placeholder="Suchen …"
          aria-label="Suchen"
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={onSearchKeyDown}
          className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-transparent pl-8 pr-2.5 text-sm text-foreground placeholder:text-foreground-subtle focus:border-border-strong focus:outline-none"
        />
        {searchOpen && query.trim() ? (
          <div className={MENU_PANEL_CLASS}>
            {results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-foreground-subtle">
                Keine Treffer
              </div>
            ) : (
              results.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="block truncate px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                >
                  {r.label}
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div ref={newRef} className="relative">
        <button
          type="button"
          onClick={() => setNewOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={newOpen}
          aria-label="Neu"
          className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-accent text-white hover:opacity-90"
        >
          {newOpen ? (
            <X size={16} aria-hidden />
          ) : (
            <Plus size={16} aria-hidden />
          )}
        </button>
        {newOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-lg"
          >
            <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold tracking-wider text-foreground-subtle">
              NEU ERSTELLEN
            </div>
            {newItems.length === 0 ? (
              <div className="px-3 py-2 text-sm text-foreground-subtle">
                Keine verfügbar
              </div>
            ) : (
              newItems.map((i) => (
                <Link
                  key={i.href}
                  href={i.href}
                  role="menuitem"
                  onClick={() => setNewOpen(false)}
                  className="block px-3 py-2 text-sm text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                >
                  {i.label}
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      {label ? (
        <div className="px-3 pb-1 pt-2 text-[10px] font-semibold tracking-wider text-foreground-subtle">
          {label}
        </div>
      ) : null}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Item({
  def,
  active,
  siteId,
  collapsed,
  badge,
  badgeClass,
  t,
}: {
  def: ModuleDefinition;
  active: boolean;
  siteId: string;
  collapsed: boolean;
  badge?: number;
  badgeClass?: string;
  t: (labelKey: string) => string;
}) {
  const label = t(def.labelKey);

  return (
    <li>
      <Link
        href={def.basePath(siteId)}
        title={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm",
          collapsed && "justify-center px-0",
          active
            ? "bg-surface-raised font-medium text-foreground"
            : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
        )}
      >
        {active ? (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
        ) : null}
        <Icon name={def.icon} />
        {!collapsed ? <span className="flex-1 truncate">{label}</span> : null}
        {!collapsed && badge ? (
          <span
            className={cn(
              "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-medium text-white",
              badgeClass ?? "bg-accent",
            )}
          >
            {badge}
          </span>
        ) : null}
      </Link>

      {active && !collapsed && def.children.length > 0 ? (
        <ul className="mb-1 ml-8 mt-0.5 space-y-0.5 border-l border-border pl-2">
          {def.children.map((c) => (
            <li key={c.slug}>
              <Link
                href={`${def.basePath(siteId)}/${c.slug}`}
                className="block rounded-[var(--radius-sm)] px-2 py-1 text-[13px] text-foreground-muted hover:text-foreground"
              >
                {t(c.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
