// The marketing-URL country segment (/at, /de, /ch) — a static, closed
// set, deliberately NOT the same axis as Locale (src/lib/i18n/locale.ts,
// en/de/ro, "what language"). See
// SLD_IMPLEMENTATION_PLAN_austria-first.md §4.1: country answers "which
// law/limits/terminology," language answers "what words." RO is not a
// marketing country — it's a Site.country value only (dev fixture), not a
// public-facing market page.
export const MARKETING_COUNTRIES = ["at", "de", "ch"] as const;
export type MarketingCountry = (typeof MARKETING_COUNTRIES)[number];

export function isMarketingCountry(value: string): value is MarketingCountry {
  return (MARKETING_COUNTRIES as readonly string[]).includes(value);
}
