"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { demoLabel } from "@/components/sidebar/demo-labels";
import {
  ACTION_STATUS_TONE,
  ASSESSMENT_STATUS_TONE,
  Badge,
  CATEGORY_CHECK_TONE,
  RISK_BAND_TONE,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { type Column, DataTable } from "@/components/ui/data-table";
import {
  Checkbox,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/field";
import { EmptyState, Progress, Timeline } from "@/components/ui/misc";
import {
  ActionStatus,
  CategoryCheckStatus,
  RiskAssessmentStatus,
  RiskBand,
} from "@/generated/prisma/enums";
import { MODULE_REGISTRY, ModuleKey } from "@/lib/modules/registry";

const SITE = "demo-site";

export function DesignShowcase() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [active, setActive] = useState<ModuleKey>(ModuleKey.RISK);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <div className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto max-w-6xl space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
              Design-System & Navigation — Vorschlag (P2)
            </h1>
            <p className="mt-1 text-sm text-foreground-muted">
              Dev-only Vorschau. Tokens, Primitives, Sidebar und drei
              Seiten-Mockups zur Freigabe vor dem Shell-Bau.
            </p>
          </div>
          <Button variant="secondary" onClick={toggleTheme}>
            Theme: {theme === "dark" ? "Dunkel" : "Hell"} — wechseln
          </Button>
        </header>

        <Tokens />
        <Primitives />
        <Sidebars
          active={active}
          setActive={setActive}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
        />
        <Mockups />
        <DependencyProposal />
      </div>
    </div>
  );
}

function Band({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-[family-name:var(--font-heading)] text-lg font-semibold">
      {children}
    </h2>
  );
}

function Swatch({ cls, name }: { cls: string; name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-9 w-9 rounded-[var(--radius-md)] border border-border ${cls}`}
      />
      <code className="text-xs text-foreground-muted">{name}</code>
    </div>
  );
}

function Tokens() {
  return (
    <section>
      <Band>1 · Tokens (beide Themes via Umschalter oben)</Band>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Flächen & Text" />
          <CardBody className="grid grid-cols-2 gap-3">
            <Swatch cls="bg-background" name="background" />
            <Swatch cls="bg-surface" name="surface" />
            <Swatch cls="bg-surface-raised" name="surface-raised" />
            <Swatch cls="bg-surface-sunken" name="surface-sunken" />
            <Swatch cls="bg-accent" name="accent" />
            <Swatch cls="bg-border" name="border" />
            <div className="col-span-2 space-y-1 pt-2">
              <p className="text-foreground">foreground — Primärtext</p>
              <p className="text-foreground-muted">
                foreground-muted — Sekundär
              </p>
              <p className="text-foreground-subtle">
                foreground-subtle — Hinweis
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Status-Palette"
            description="Vollfarbige Chips, weißer Text — AA theme-unabhängig"
          />
          <CardBody className="grid grid-cols-2 gap-3">
            <Swatch cls="bg-status-low" name="status-low" />
            <Swatch cls="bg-status-moderate" name="status-moderate" />
            <Swatch cls="bg-status-elevated" name="status-elevated" />
            <Swatch cls="bg-status-high" name="status-high" />
            <Swatch cls="bg-status-info" name="status-info" />
            <Swatch cls="bg-status-neutral" name="status-neutral" />
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

function Primitives() {
  return (
    <section>
      <Band>2 · Primitives</Band>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Buttons" />
          <CardBody className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primär</Button>
            <Button variant="secondary">Sekundär</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Löschen</Button>
            <Button size="sm">Klein</Button>
            <Button disabled>Deaktiviert</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status-Chips (aus Enums)" />
          <CardBody className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-2">
              {Object.values(RiskBand).map((b) => (
                <Badge key={b} tone={RISK_BAND_TONE[b]}>
                  {b}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.values(CategoryCheckStatus).map((s) => (
                <Badge key={s} tone={CATEGORY_CHECK_TONE[s]}>
                  {s}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.values(ActionStatus).map((s) => (
                <Badge key={s} tone={ACTION_STATUS_TONE[s]}>
                  {s}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.values(RiskAssessmentStatus).map((s) => (
                <Badge key={s} tone={ASSESSMENT_STATUS_TONE[s]}>
                  {s}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Formularfelder" />
          <CardBody className="space-y-3">
            <div>
              <Label htmlFor="d-in">Bezeichnung</Label>
              <Input id="d-in" placeholder="z. B. Pressenstand 3" />
            </div>
            <div>
              <Label htmlFor="d-sel">Gefährdungskategorie</Label>
              <Select id="d-sel" defaultValue="NOISE">
                <option value="NOISE">Lärm</option>
                <option value="VIBRATION">Vibration</option>
                <option value="CHEMICAL">Chemisch</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="d-ta">Notiz</Label>
              <Textarea id="d-ta" placeholder="Bestehende Maßnahmen …" />
            </div>
            <Checkbox
              id="d-cb"
              label="Als wiederkehrend markieren"
              defaultChecked
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Fortschritt, Timeline, Leerzustand" />
          <CardBody className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-foreground-muted">
                <span>Vollständigkeit</span>
                <span>9 / 13</span>
              </div>
              <Progress value={9} max={13} />
            </div>
            <Timeline
              items={[
                {
                  title: "Erstbeurteilung",
                  meta: "12.02.2026 · APPROVED",
                  body: "Band HOCH festgestellt",
                },
                {
                  title: "Nachbeurteilung",
                  meta: "03.09.2026 · APPROVED",
                  body: "Band MÄSSIG",
                  connector:
                    "Verifiziert durch: Höhenverstellbarer Hubtisch (Wirksam)",
                },
              ]}
            />
            <EmptyState
              title="Noch keine Begehung geplant"
              description="Planen Sie die erste Begehung für diesen Standort."
              action={<Button size="sm">Begehung planen</Button>}
            />
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

type SidebarsProps = {
  active: ModuleKey;
  setActive: (k: ModuleKey) => void;
  drawerOpen: boolean;
  setDrawerOpen: (b: boolean) => void;
};

function Sidebars({
  active,
  setActive,
  drawerOpen,
  setDrawerOpen,
}: SidebarsProps) {
  const modules = MODULE_REGISTRY;
  const badges = {
    "overdue-actions": 7,
    "open-my-tasks": 4,
    "open-incidents": 1,
    "due-trainings": 3,
  } as const;
  return (
    <section>
      <Band>3 · Sidebar (registry-getrieben)</Band>
      <p className="mb-4 text-sm text-foreground-muted">
        Aktives Modul umschalten, um Akkordeon und Markierung zu sehen:
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {MODULE_REGISTRY.map((m) => (
          <Button
            key={m.key}
            size="sm"
            variant={m.key === active ? "primary" : "secondary"}
            onClick={() => setActive(m.key)}
          >
            {demoLabel(m.labelKey)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <p className="mb-2 text-xs text-foreground-subtle">
            Ausgeklappt (264px)
          </p>
          <div className="h-[640px] overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <AppSidebar
              modules={modules}
              activeKey={active}
              siteId={SITE}
              badges={badges}
              t={demoLabel}
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-foreground-subtle">
            Eingeklappt (64px, Icon-Rail)
          </p>
          <div className="h-[640px] overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <AppSidebar
              modules={modules}
              activeKey={active}
              siteId={SITE}
              collapsed
              badges={badges}
              t={demoLabel}
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs text-foreground-subtle">
            Mobil (Drawer &lt; 1024px)
          </p>
          <div className="relative h-[640px] w-[360px] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-background">
            <div className="flex h-12 items-center gap-3 border-b border-border px-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDrawerOpen(!drawerOpen)}
              >
                ☰
              </Button>
              <span className="text-sm font-medium">Werk Linz</span>
            </div>
            {drawerOpen ? (
              <div className="absolute inset-0 top-12 flex">
                <div className="h-full">
                  <AppSidebar
                    modules={modules}
                    activeKey={active}
                    siteId={SITE}
                    badges={badges}
                    t={demoLabel}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Drawer schließen"
                  className="h-full flex-1 bg-black/40"
                  onClick={() => setDrawerOpen(false)}
                />
              </div>
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-foreground-subtle">
                ☰ antippen, um den Drawer zu öffnen
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Mockups() {
  return (
    <section>
      <Band>4 · Seiten-Mockups</Band>
      <div className="space-y-6">
        <HubMockup />
        <ActionsMockup />
        <InspectionRunMockup />
      </div>
    </section>
  );
}

const HUB_CATEGORIES: [string, CategoryCheckStatus][] = [
  ["Ergonomie / MSE", "HAZARD_PRESENT"],
  ["Lärm", "HAZARD_PRESENT"],
  ["Vibration", "CHECKED_NO_HAZARD"],
  ["Beleuchtung", "CHECKED_NO_HAZARD"],
  ["Klima / Hitze", "NOT_APPLICABLE"],
  ["Chemisch", "HAZARD_PRESENT"],
  ["Staub", "OPEN"],
  ["Biologisch", "NOT_APPLICABLE"],
  ["Psychosozial", "OPEN"],
  ["Elektrisch", "CHECKED_NO_HAZARD"],
  ["Brand / Explosion", "OPEN"],
  ["Strahlung", "NOT_APPLICABLE"],
  ["Physikalisch / mechanisch", "CHECKED_NO_HAZARD"],
];

function HubMockup() {
  const done = HUB_CATEGORIES.filter(([, s]) => s !== "OPEN").length;
  return (
    <Card>
      <CardHeader
        title="Arbeitsplatz-Hub — Pressenstand 3"
        description="Evaluierung · DRAFT · 13-Kategorien-Vollständigkeit"
        action={
          <Button disabled title="Erst wenn alle Kategorien bearbeitet sind">
            Zur Prüfung freigeben
          </Button>
        }
      />
      <CardBody className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-xs text-foreground-muted">
            <span>Vollständigkeit</span>
            <span>
              {done} / 13 — {13 - done} offen
            </span>
          </div>
          <Progress
            value={done}
            max={13}
            tone={done === 13 ? "low" : "accent"}
          />
        </div>
        <ul className="divide-y divide-border rounded-[var(--radius-md)] border border-border">
          {HUB_CATEGORIES.map(([name, status]) => (
            <li
              key={name}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <span>{name}</span>
              <Badge tone={CATEGORY_CHECK_TONE[status]}>{status}</Badge>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

type ActionRow = {
  title: string;
  source: string;
  due: string;
  status: ActionStatus;
};
const ACTIONS: ActionRow[] = [
  {
    title: "Höhenverstellbarer Hubtisch beschaffen",
    source: "Befund · Pressenstand 3",
    due: "15.11.2026",
    status: "IN_PROGRESS",
  },
  {
    title: "Gehörschutz-Unterweisung durchführen",
    source: "Lärm-Befund",
    due: "01.11.2026",
    status: "OPEN",
  },
  {
    title: "Absaugung Lötplatz nachrüsten",
    source: "Chemisch-Befund",
    due: "20.10.2026",
    status: "IMPLEMENTED",
  },
  {
    title: "Notbeleuchtung geprüft",
    source: "Begehung Q3",
    due: "30.09.2026",
    status: "VERIFIED",
  },
];

function ActionsMockup() {
  const cols: Column<ActionRow>[] = [
    {
      header: "Maßnahme",
      cell: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      header: "Quelle",
      cell: (r) => <span className="text-foreground-muted">{r.source}</span>,
    },
    { header: "Fällig", cell: (r) => r.due },
    {
      header: "Status",
      cell: (r) => (
        <Badge tone={ACTION_STATUS_TONE[r.status]}>{r.status}</Badge>
      ),
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Maßnahmen — Liste"
        description="Ein Register über alle Quellen"
        action={<Button size="sm">+ Maßnahme</Button>}
      />
      <CardBody>
        <DataTable columns={cols} rows={ACTIONS} getRowKey={(r) => r.title} />
      </CardBody>
    </Card>
  );
}

function InspectionRunMockup() {
  return (
    <Card>
      <CardHeader
        title="Begehung durchführen — Rundgang Halle 2"
        description="Schritt 2 von 5 · tablet-tauglich"
      />
      <CardBody className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium">
            Fluchtwege frei und gekennzeichnet?
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">
              Ja
            </Button>
            <Button variant="danger" size="sm">
              Nein
            </Button>
            <Button variant="ghost" size="sm">
              n. z.
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="ins-n">Schweregrad bei Abweichung</Label>
          <Select id="ins-n" defaultValue="">
            <option value="" disabled>
              Bitte wählen …
            </option>
            <option>Gering</option>
            <option>Mittel</option>
            <option>Hoch</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="ins-t">Beobachtung</Label>
          <Textarea
            id="ins-t"
            placeholder="Beschreibung der Abweichung (keine Personen fotografieren)"
          />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost">← Zurück</Button>
          <span className="text-xs text-foreground-subtle">
            Offline-Antworten werden synchronisiert
          </span>
          <Button>Weiter →</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function DependencyProposal() {
  return (
    <section>
      <Band>5 · Abhängigkeiten — Vorschlag (noch nicht installiert)</Band>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader title="radix-ui" />
          <CardBody className="text-sm text-foreground-muted">
            Ungestylte, barrierefreie Primitives (Dialog, Drawer, Dropdown,
            Tooltip, Combobox, Tabs) — wir stylen mit Tokens, kein visuelles
            Lock-in. Vom Plan ausdrücklich zugelassen (§5.2).
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="lucide-react" />
          <CardBody className="text-sm text-foreground-muted">
            Ein konsistentes, tree-shakeable Linien-Icon-Set (MIT) — ersetzt die
            provisorischen Inline-SVGs hier durch eine gepflegte Bibliothek.
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="tailwind-merge (optional)" />
          <CardBody className="text-sm text-foreground-muted">
            Dedupliziert kollidierende Tailwind-Klassen in <code>cn()</code> —
            nur Komfort, nicht zwingend.
          </CardBody>
        </Card>
      </div>
      <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-sunken p-4 text-sm text-foreground-muted">
        <p className="mb-1 font-medium text-foreground">
          Status der Primitives
        </p>
        Gebaut &amp; hier gezeigt: Button, Badge/Status-Chip (aus Enums), Card,
        Input/Select/Textarea/Checkbox, Progress, Timeline, EmptyState,
        DataTable (Optik), Sidebar. Für den Vollausbau mit Radix vorgesehen:
        Combobox, Datepicker, Dialog, Drawer, Tooltip, Toast, Kalender/Agenda,
        Datei-Upload, plus Tabelle mit
        Sortierung/Filter/Spaltenwahl/gespeicherten Ansichten.
      </div>
    </section>
  );
}
