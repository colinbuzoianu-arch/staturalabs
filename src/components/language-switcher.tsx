"use client";

import { useRouter } from "next/navigation";
import { getCommonDictionary } from "@/lib/i18n/dictionaries/common";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/locale-context";

// Deliberately styled with `text-current`/`currentColor` rather than brand
// color tokens — this one component is reused in four visually distinct
// header contexts (marketing's teal header, the dashboard's theme-aware
// header, the plain unstyled /admin bar, and the login page), so it
// inherits whatever text color its surroundings already establish instead
// of needing a variant per context.
export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const dict = getCommonDictionary(locale);

  function handleSelect(next: (typeof LOCALES)[number]) {
    if (next === locale) return;
    setLocale(next);
    // Server Components render translated text server-side and don't
    // re-render just because the cookie changed client-side — refresh
    // re-fetches the current route's server payload so they pick up the
    // new locale immediately, without a full page reload.
    router.refresh();
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> brings default browser border/padding to reset for what's a small nav-style control, not a form.
    <div
      role="group"
      aria-label={dict.languageSwitcher.ariaLabel}
      className="flex items-center gap-1 text-xs font-technical"
    >
      {LOCALES.map((code, i) => (
        <span key={code} className="flex items-center gap-1">
          {i > 0 && <span className="text-current opacity-30">/</span>}
          <button
            type="button"
            onClick={() => handleSelect(code)}
            aria-pressed={code === locale}
            className={`rounded px-1 py-0.5 text-current transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
              code === locale
                ? "font-bold opacity-100"
                : "opacity-50 hover:opacity-80"
            }`}
          >
            {LOCALE_LABELS[code]}
          </button>
        </span>
      ))}
    </div>
  );
}
