import type { Metadata } from "next";
import localFont from "next/font/local";
import { getLocale } from "@/lib/i18n/get-locale";
import { LocaleProvider } from "@/lib/i18n/locale-context";
import "./globals.css";

// Self-hosted brand typefaces, provisioned into /public/fonts by
// scripts/fetch-fonts.mjs (npm run predev / prebuild) — see that script for
// why these aren't loaded via next/font/google at runtime.
const outfit = localFont({
  src: [
    {
      path: "../../public/fonts/outfit-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/outfit-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-outfit",
  display: "swap",
});

const jura = localFont({
  src: "../../public/fonts/jura-500.woff2",
  weight: "500",
  variable: "--font-jura",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../../public/fonts/jetbrains-mono-400.woff2",
  weight: "400",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Statura Labs Dynamics",
    template: "%s · Statura Labs Dynamics",
  },
  description: "Camera-based workplace ergonomics assessment platform.",
  icons: {
    icon: "/logo/statura_logo_on_dark.svg",
  },
};

// Inline, blocking script — runs before first paint to apply a persisted
// theme choice from localStorage. Dark is the default (baked into the
// server-rendered data-theme="dark" below and into globals.css's :root
// tokens), so this only ever needs to *override* to "light"; there is
// deliberately no server-side theme setting yet (CLAUDE.md).
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("statura-theme");if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      data-theme="dark"
      className={`${outfit.variable} ${jura.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, no user input — theme-init script only */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
