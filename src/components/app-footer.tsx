// Legal/compliance-facing copy — stays on the operating entity (Verumsell
// SRL), not the "Statura Labs Dynamics" brand name, per CLAUDE.md.
export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="px-6 py-4 text-right text-xs text-border">
      © {year} Verumsell SRL · Statura Labs Dynamics is a product of Verumsell
      SRL.
    </footer>
  );
}
