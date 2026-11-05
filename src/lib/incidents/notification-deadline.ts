import type { IncidentType } from "@/generated/prisma/enums";

// P10d (SLD_P10_STATUTORY_NOTIFICATIONS_APPROVED.md §A/§D.2) — the pure
// resolver that turns a country + incident type (+ whether it is a fatal/mass
// case) into the statutory notification duty. No DB here: the caller passes the
// already-fetched rules for the country (same pure/impure split as
// matchScoringRule / lookupScoringRule). Fail-closed: a (country, type) with no
// rule returns { kind: "none" } — never a cross-country borrow (§3.15).

export type NotificationRuleShape = {
  incidentType: IncidentType;
  appliesToFatalOrMass: boolean;
  deadline: string | null; // ISO-8601 duration, e.g. "P5D"
  immediate: boolean;
  asSoonAsPossible: boolean;
  thresholdText: string;
  clockStartsText: string | null;
  legalReferenceId: string;
};

export type NotificationDuty =
  | {
      kind: "deadline";
      dueAt: Date;
      durationDays: number;
      rule: NotificationRuleShape;
    }
  | { kind: "immediate"; rule: NotificationRuleShape }
  | { kind: "asSoonAsPossible"; rule: NotificationRuleShape }
  | { kind: "none" };

// Minimal ISO-8601 duration parser — only whole days ("P<n>D") are used by the
// seeded catalogue. Returns null for anything else, so an unexpected format
// fails loudly (no silent "0 days").
export function parseDurationDays(duration: string | null): number | null {
  if (!duration) return null;
  const m = /^P(\d+)D$/.exec(duration);
  return m ? Number.parseInt(m[1], 10) : null;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Pick the applicable rule and resolve the duty. When the incident is a
// fatal/mass case and a fatal-or-mass variant exists, it wins; otherwise the
// standard (appliesToFatalOrMass = false) rule is used.
export function resolveNotificationDeadline(
  rules: readonly NotificationRuleShape[],
  type: IncidentType,
  knownAt: Date,
  opts?: { fatalOrMass?: boolean },
): NotificationDuty {
  const forType = rules.filter((r) => r.incidentType === type);
  if (forType.length === 0) return { kind: "none" };

  const fatalOrMass = opts?.fatalOrMass ?? false;
  const rule =
    (fatalOrMass && forType.find((r) => r.appliesToFatalOrMass)) ||
    forType.find((r) => !r.appliesToFatalOrMass) ||
    forType[0];

  if (rule.immediate) return { kind: "immediate", rule };
  if (rule.asSoonAsPossible) return { kind: "asSoonAsPossible", rule };
  const days = parseDurationDays(rule.deadline);
  if (days === null) return { kind: "none" };
  return {
    kind: "deadline",
    dueAt: addDays(knownAt, days),
    durationDays: days,
    rule,
  };
}
