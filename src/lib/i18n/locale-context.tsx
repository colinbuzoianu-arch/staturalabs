"use client";

import { createContext, useContext, useState } from "react";
import { LOCALE_COOKIE, type Locale } from "./locale";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);

// Client-side locale state, seeded from the server (root layout reads the
// cookie via getLocale() and passes it in as `initialLocale`) so there's no
// hydration mismatch and no flash — this only exists so client components
// (LanguageSwitcher, the capture page, ThemeToggle-adjacent UI) can read
// and change the current language reactively without a full navigation.
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  function setLocale(next: Locale) {
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API isn't supported in Safari; a plain cookie write is the broadly-compatible choice for a simple non-httpOnly preference cookie like this one.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLocaleState(next);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}
