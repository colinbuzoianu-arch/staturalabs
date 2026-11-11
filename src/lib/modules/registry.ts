import { ModuleKey } from "@/generated/prisma/enums";
import type { Permission } from "@/lib/auth/permissions";

// The module registry (SLD_RESTRUCTURE_PLAN_platform-modules.md §2.4): the
// single source of truth for the left-sidebar menu, route guards and
// entitlement. Nothing about a module's placement, permission or route is
// hand-written per page — it is read from here. Pure data + pure helpers, no
// `server-only` and no DB, so it is importable from client components (the
// P2 sidebar) and unit-testable directly.
//
// Labels live in i18n/country packs, never here (§2.1): `labelKey` is a stable
// dictionary key, and where a country uses a different legal term (e.g. AT
// "Evaluierung" vs. DE "Gefährdungsbeurteilung") the CountryPack overrides it,
// resolved at render time — this registry stays country-neutral.

export { ModuleKey };

// Menu sections, top to bottom (§5.1: ÜBERSICHT / BEURTEILEN / STEUERN /
// NACHWEISEN, then the pinned-to-bottom configuration area). The plan's §2.4
// interface lists four groups; "system" is a deliberate, documented addition
// for the bottom-pinned Stammdaten & Einstellungen area the §5.1 mock shows
// separated from the four scrolling groups — cleaner than a parallel boolean.
export type MenuGroup =
  | "overview"
  | "assess"
  | "control"
  | "evidence"
  | "system";

export const MENU_GROUP_ORDER: readonly MenuGroup[] = [
  "overview",
  "assess",
  "control",
  "evidence",
  "system",
];

// The domain a module belongs to (§2.2 rule 8). "shared" modules (actions,
// documents, inspections, incidents, legal, …) carry an explicit per-RECORD
// domain so an artifact never mixes OSH and environment vocabularies — the
// module-level value here is only for grouping/labelling, never a substitute
// for the per-record domain tag.
export type ModuleDomain = "osh" | "environment" | "shared";

// Placeholder icon identifiers. P2 maps these to the chosen icon set (one set,
// proposed with a one-line reason per §5.2); kept as a string union so a typo
// is a compile error and the set swap is one mapping table, not a sweep.
export type IconName =
  | "cockpit"
  | "inbox"
  | "calendar"
  | "clipboard-check"
  | "search"
  | "alert-triangle"
  | "leaf"
  | "target"
  | "flask"
  | "graduation-cap"
  | "users"
  | "scale"
  | "folder"
  | "bar-chart"
  | "settings";

// Where a badge count comes from (§5.1). The actual count query lands with the
// notifications/cockpit work (P4/P5); this names the source so the registry
// stays the one place that declares a module HAS a badge.
export type BadgeSource =
  | "open-my-tasks"
  | "open-incidents"
  | "overdue-actions"
  | "due-trainings";

export interface SubItem {
  // Stable i18n dictionary key (resolved at render time, country-pack aware).
  labelKey: string;
  // Route segment appended under the module's basePath.
  slug: string;
}

export interface ModuleDefinition {
  key: ModuleKey;
  // Stable i18n key for the module's own label (country-pack may override).
  labelKey: string;
  menuGroup: MenuGroup;
  domain: ModuleDomain;
  // Position in the sidebar, ascending (gaps left between values so a module
  // can be inserted later without renumbering).
  order: number;
  // False only for the baseline modules the plan names (§2.4): cockpit,
  // my-tasks, actions, documents, settings. Everything else is gated by a
  // CompanyModule row.
  requiresEntitlement: boolean;
  // The permission needed to see/enter the module (its `.read`).
  permission: Permission;
  // The module's base route for a given site. Site-scoped modules resolve to
  // /app/s/[siteId]/<slug> (§2.3); the two cross-cutting personal/config areas
  // resolve to /app/me and /app/settings and ignore siteId.
  basePath: (siteId: string) => string;
  icon: IconName;
  children: readonly SubItem[];
  badge?: BadgeSource;
  // P13 §2.2 lifecycle: `planned` modules can never be unlocked for a tenant;
  // `beta` can be unlocked per tenant and shows a "Beta" badge in its nav;
  // `stable` is the default. Omitted ⇒ stable (every built module today).
  status?: ModuleStatus;
}

export type ModuleStatus = "planned" | "beta" | "stable";

export function moduleStatus(def: ModuleDefinition): ModuleStatus {
  return def.status ?? "stable";
}

// Route segment for a module under /app/s/[siteId]. my-tasks and settings are
// NOT site-scoped (§2.3: /app/me, /app/settings) and are special-cased in
// basePath below rather than given a site segment.
function siteModulePath(slug: string): (siteId: string) => string {
  return (siteId: string) => `/app/s/${siteId}/${slug}`;
}

export const MODULE_REGISTRY: readonly ModuleDefinition[] = [
  {
    key: ModuleKey.COCKPIT,
    labelKey: "modules.cockpit.label",
    menuGroup: "overview",
    domain: "shared",
    order: 10,
    requiresEntitlement: false,
    permission: "cockpit.read",
    basePath: siteModulePath("cockpit"),
    icon: "cockpit",
    children: [],
  },
  {
    key: ModuleKey.MY_TASKS,
    labelKey: "modules.my-tasks.label",
    menuGroup: "overview",
    domain: "shared",
    order: 20,
    requiresEntitlement: false,
    permission: "my-tasks.read",
    basePath: () => "/app/me",
    icon: "inbox",
    children: [],
    badge: "open-my-tasks",
  },
  {
    // P14 G2: the cross-module Aktivitätenkalender — a read-only aggregation of
    // every due-dated item (actions, inspections, assessment/legal reviews,
    // incident notification deadlines) over the user's accessible scope. Baseline
    // (no entitlement): an overview surface like cockpit/my-tasks.
    key: ModuleKey.CALENDAR,
    labelKey: "modules.calendar.label",
    menuGroup: "overview",
    domain: "shared",
    order: 15,
    requiresEntitlement: false,
    permission: "calendar.read",
    basePath: siteModulePath("calendar"),
    icon: "calendar",
    children: [],
  },
  {
    key: ModuleKey.RISK,
    labelKey: "modules.risk.label",
    menuGroup: "assess",
    domain: "osh",
    order: 30,
    requiresEntitlement: true,
    permission: "risk.read",
    basePath: siteModulePath("risk"),
    icon: "clipboard-check",
    // Children are added as each risk page migrates into the shell. Migrated:
    // workstations (hub + tasks + assess), processes, assessments (list +
    // detail), floor-plan. Still to come: ergonomics (needs its own overview
    // page — no route yet).
    children: [
      { labelKey: "modules.risk.children.workstations", slug: "workstations" },
      { labelKey: "modules.risk.children.processes", slug: "processes" },
      { labelKey: "modules.risk.children.assessments", slug: "assessments" },
      { labelKey: "modules.risk.children.floor-plan", slug: "floor-plan" },
    ],
  },
  {
    key: ModuleKey.INSPECTIONS,
    labelKey: "modules.inspections.label",
    menuGroup: "assess",
    domain: "shared",
    order: 40,
    requiresEntitlement: true,
    permission: "inspections.read",
    basePath: siteModulePath("inspections"),
    icon: "search",
    children: [
      { labelKey: "modules.inspections.children.planned", slug: "planned" },
      {
        labelKey: "modules.inspections.children.performed",
        slug: "performed",
      },
      { labelKey: "modules.inspections.children.templates", slug: "templates" },
    ],
  },
  {
    key: ModuleKey.INCIDENTS,
    labelKey: "modules.incidents.label",
    menuGroup: "assess",
    domain: "shared",
    order: 50,
    requiresEntitlement: true,
    permission: "incidents.read",
    basePath: siteModulePath("incidents"),
    icon: "alert-triangle",
    children: [
      { labelKey: "modules.incidents.children.reports", slug: "reports" },
      {
        labelKey: "modules.incidents.children.investigations",
        slug: "investigations",
      },
      {
        labelKey: "modules.incidents.children.notifications",
        slug: "notifications",
      },
      {
        labelKey: "modules.incidents.children.verbandbuch",
        slug: "verbandbuch",
      },
    ],
    badge: "open-incidents",
  },
  {
    key: ModuleKey.ENVIRONMENT,
    labelKey: "modules.environment.label",
    menuGroup: "assess",
    domain: "environment",
    order: 60,
    requiresEntitlement: true,
    permission: "environment.read",
    basePath: siteModulePath("environment"),
    icon: "leaf",
    // The environment module is a single landing today (the
    // Umweltaspekte/assessment flow lives on one page); aspects, quantities
    // and documents are sections within it, not separate routes yet, so no
    // sidebar children until they get their own pages.
    children: [],
  },
  {
    key: ModuleKey.ACTIONS,
    labelKey: "modules.actions.label",
    menuGroup: "control",
    domain: "shared",
    order: 70,
    requiresEntitlement: false,
    permission: "actions.read",
    basePath: siteModulePath("actions"),
    icon: "target",
    // The register (list) is the module landing; Kalender and Wirksamkeit are
    // its two views (§7.1).
    children: [
      { labelKey: "modules.actions.children.calendar", slug: "calendar" },
      {
        labelKey: "modules.actions.children.effectiveness",
        slug: "effectiveness",
      },
    ],
    badge: "overdue-actions",
  },
  {
    key: ModuleKey.CHEMICALS,
    labelKey: "modules.chemicals.label",
    menuGroup: "control",
    domain: "osh",
    order: 80,
    requiresEntitlement: true,
    permission: "chemicals.read",
    basePath: siteModulePath("chemicals"),
    icon: "flask",
    children: [
      { labelKey: "modules.chemicals.children.register", slug: "register" },
      {
        labelKey: "modules.chemicals.children.safety-data-sheets",
        slug: "safety-data-sheets",
      },
      {
        labelKey: "modules.chemicals.children.operating-instructions",
        slug: "operating-instructions",
      },
    ],
  },
  {
    key: ModuleKey.TRAINING,
    labelKey: "modules.training.label",
    menuGroup: "control",
    domain: "shared",
    order: 90,
    requiresEntitlement: true,
    permission: "training.read",
    basePath: siteModulePath("training"),
    icon: "graduation-cap",
    children: [
      { labelKey: "modules.training.children.matrix", slug: "matrix" },
      { labelKey: "modules.training.children.sessions", slug: "sessions" },
      { labelKey: "modules.training.children.records", slug: "records" },
      {
        labelKey: "modules.training.children.requirements",
        slug: "requirements",
      },
    ],
    badge: "due-trainings",
  },
  {
    key: ModuleKey.PEOPLE,
    labelKey: "modules.people.label",
    menuGroup: "control",
    domain: "shared",
    order: 100,
    requiresEntitlement: true,
    permission: "people.read",
    basePath: siteModulePath("people"),
    icon: "users",
    children: [],
  },
  {
    key: ModuleKey.LEGAL,
    labelKey: "modules.legal.label",
    menuGroup: "evidence",
    domain: "shared",
    order: 110,
    requiresEntitlement: true,
    permission: "legal.read",
    basePath: siteModulePath("legal"),
    icon: "scale",
    children: [
      { labelKey: "modules.legal.children.register", slug: "register" },
      { labelKey: "modules.legal.children.reviewDue", slug: "review-due" },
    ],
  },
  {
    key: ModuleKey.DOCUMENTS,
    labelKey: "modules.documents.label",
    menuGroup: "evidence",
    domain: "shared",
    order: 120,
    requiresEntitlement: false,
    permission: "documents.read",
    basePath: siteModulePath("documents"),
    icon: "folder",
    children: [
      { labelKey: "modules.documents.children.library", slug: "library" },
      { labelKey: "modules.documents.children.generated", slug: "generated" },
    ],
  },
  {
    key: ModuleKey.REPORTS,
    labelKey: "modules.reports.label",
    menuGroup: "evidence",
    domain: "shared",
    order: 130,
    requiresEntitlement: true,
    permission: "reports.read",
    basePath: siteModulePath("reports"),
    icon: "bar-chart",
    // The site risk overview is the reports landing; P12 adds the KPI cockpit.
    children: [{ labelKey: "modules.reports.children.kpis", slug: "kpis" }],
  },
  {
    key: ModuleKey.SETTINGS,
    labelKey: "modules.settings.label",
    menuGroup: "system",
    domain: "shared",
    order: 900,
    requiresEntitlement: false,
    permission: "settings.read",
    // Site-scoped: the master data here (org tree, hazard catalogue) is
    // per-site, so settings lives under /app/s/[siteId]/settings alongside the
    // other modules rather than the cross-site /app/settings the §2.3 sketch
    // imagined — a deliberate, recorded deviation. Users & roles / company
    // config land later (§7.11).
    basePath: siteModulePath("settings"),
    icon: "settings",
    children: [
      {
        labelKey: "modules.settings.children.organisation",
        slug: "org-units",
      },
      {
        labelKey: "modules.settings.children.users-roles",
        slug: "users",
      },
      {
        labelKey: "modules.settings.children.data-retention",
        slug: "retention",
      },
      { labelKey: "modules.settings.children.catalogues", slug: "hazards" },
    ],
  },
];

// Lookup by key. Built once; the registry is static data.
const REGISTRY_BY_KEY: ReadonlyMap<ModuleKey, ModuleDefinition> = new Map(
  MODULE_REGISTRY.map((m) => [m.key, m]),
);

export function getModuleDefinition(key: ModuleKey): ModuleDefinition {
  const def = REGISTRY_BY_KEY.get(key);
  if (!def) {
    // Unreachable while the registry covers every ModuleKey (guaranteed by the
    // registry.test.ts coverage test), but fail loud rather than return undefined.
    throw new Error(`No module definition registered for key: ${key}`);
  }
  return def;
}

// Modules in sidebar order (menu group, then `order` within the group).
export function modulesInMenuOrder(): readonly ModuleDefinition[] {
  return [...MODULE_REGISTRY].sort((a, b) => {
    const ga = MENU_GROUP_ORDER.indexOf(a.menuGroup);
    const gb = MENU_GROUP_ORDER.indexOf(b.menuGroup);
    return ga !== gb ? ga - gb : a.order - b.order;
  });
}

// The baseline modules that never require an entitlement row (§2.4).
export function baselineModuleKeys(): readonly ModuleKey[] {
  return MODULE_REGISTRY.filter((m) => !m.requiresEntitlement).map(
    (m) => m.key,
  );
}
