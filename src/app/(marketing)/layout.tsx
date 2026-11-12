import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

// Shared shell for the public marketing site (/, /about, /legal). German by
// default with an EN/RO language switcher in the header; no country segment —
// the DACH country layer lives inside the product, not in the marketing URLs.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
