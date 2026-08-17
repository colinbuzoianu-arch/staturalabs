import type { ReactNode } from "react";

// Bare structural shell only. MarketingHeader/MarketingFooter now live in
// (marketing)/[country]/layout.tsx (which needs params.country for the
// footer's About/Legal links — SLD_IMPLEMENTATION_PLAN_austria-first.md
// §4.2) and in the country-chooser page.tsx below, rather than here,
// since a layout above the [country] segment can't see that param.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-col">{children}</div>;
}
