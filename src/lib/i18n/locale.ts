import { scopedCookieName } from "@/lib/config/base-path";
export const LOCALES = ["en", "de", "ro"] as const;
export type Locale = (typeof LOCALES)[number];

// German by default — this is a DACH-first product (AT/DE/CH), so a user or
// tenant that hasn't chosen a language should see German, not English. A
// per-user cookie and a per-tenant Company.defaultLocale (e.g. a Romanian
// customer → "ro") both override this (see getLocale / getTenantDefaultLocale).
export const DEFAULT_LOCALE: Locale = "de";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  de: "DE",
  ro: "RO",
};

// Same mechanism as the dark/light theme toggle (localStorage key
// "statura-theme"), except this one also needs to be readable server-side
// (Server Components render translated text directly into the HTML, so a
// pure localStorage-only approach would flash English before client JS
// runs) — a cookie instead of localStorage, but still no server-side
// account setting, no route prefix, exactly the "saved preference" model
// asked for.
export const LOCALE_COOKIE = scopedCookieName("statura-locale");

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
