import { getDashboardDictionary } from "@/lib/i18n/dictionaries/dashboard";
import { getLocale } from "@/lib/i18n/get-locale";

// Legal/compliance-facing copy — stays on the operating entity (Verumsell
// SRL), not the "Statura Labs Dynamics" brand name, per CLAUDE.md.
export async function AppFooter() {
  const year = new Date().getFullYear();
  const locale = await getLocale();
  const dict = getDashboardDictionary(locale);

  return (
    <footer className="px-6 py-4 text-right text-xs text-border">
      {dict.footer.copyright(year)}
    </footer>
  );
}
