export const LOCALES = ["en", "de", "ro"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

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
export const LOCALE_COOKIE = "statura-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
