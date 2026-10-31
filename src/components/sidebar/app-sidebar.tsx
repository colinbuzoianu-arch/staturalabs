"use client";

import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";
import {
  type BadgeSource,
  MENU_GROUP_ORDER,
  type MenuGroup,
  type ModuleDefinition,
  type ModuleKey,
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

const GROUP_LABEL: Record<MenuGroup, string | null> = {
  overview: "ÜBERSICHT",
  assess: "BEURTEILEN",
  control: "STEUERN",
  evidence: "NACHWEISEN",
  system: null, // pinned to the bottom, no section header
};

export type SidebarProps = {
  modules: readonly ModuleDefinition[];
  activeKey: ModuleKey;
  siteId: string;
  collapsed?: boolean;
  badges?: Partial<Record<BadgeSource, number>>;
  t: (labelKey: string) => string;
  onToggleCollapse?: () => void;
};

export function AppSidebar({
  modules,
  activeKey,
  siteId,
  collapsed = false,
  badges = {},
  t,
  onToggleCollapse,
}: SidebarProps) {
  const visible = new Set(modules.map((m) => m.key));
  const ordered = modulesInMenuOrder().filter((m) => visible.has(m.key));

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
      {!collapsed ? <SiteSwitcher /> : null}
      {!collapsed ? <SearchAndNew /> : null}

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

function SiteSwitcher() {
  return (
    <button
      type="button"
      className="mx-2 mt-2 flex items-center justify-between rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm hover:border-border-strong"
    >
      <span className="truncate">
        <span className="text-foreground-subtle">Standort: </span>
        Werk Linz (AT)
      </span>
      <span aria-hidden className="text-foreground-subtle">
        ▾
      </span>
    </button>
  );
}

function SearchAndNew() {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <div className="flex h-9 flex-1 items-center gap-2 rounded-[var(--radius-md)] border border-border px-2.5 text-sm text-foreground-subtle">
        <Icon name="search" size={16} />
        <span>Suchen …</span>
      </div>
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-accent text-white"
        aria-label="Neu"
      >
        +
      </button>
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
  t,
}: {
  def: ModuleDefinition;
  active: boolean;
  siteId: string;
  collapsed: boolean;
  badge?: number;
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
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-medium text-white">
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
