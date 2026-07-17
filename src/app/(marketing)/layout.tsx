import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

// Shared shell for every public, unauthenticated marketing page (/, /about,
// /legal) — header + footer defined once here rather than duplicated per
// page. No requireXAccess gating, no dashboard chrome (that lives at
// /sites and below — see CLAUDE.md).
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
