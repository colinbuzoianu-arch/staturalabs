import Link from "next/link";

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-teal">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 text-center min-[860px]:flex-row min-[860px]:items-center min-[860px]:justify-between min-[860px]:text-left">
        <div className="flex flex-col items-center gap-4 min-[860px]:flex-row min-[860px]:items-center min-[860px]:gap-6">
          {/* Logotype mark only, not prose — see CLAUDE.md brand rules. */}
          <span className="font-wordmark text-sm tracking-[0.2em] text-ivory">
            SLD
          </span>
          <nav className="flex gap-5 text-xs text-sage-light">
            <Link href="/about" className="hover:text-ivory">
              About
            </Link>
            <Link href="/legal" className="hover:text-ivory">
              Legal
            </Link>
          </nav>
        </div>
        <p className="text-xs text-sage-light">
          © {year} Verumsell SRL · Statura Labs Dynamics is a product of
          Verumsell SRL
        </p>
      </div>
    </footer>
  );
}
