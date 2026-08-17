import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import {
  isMarketingCountry,
  MARKETING_COUNTRIES,
} from "@/lib/country/countries";

// Static param set — SLD_IMPLEMENTATION_PLAN_austria-first.md §4.2: no
// open-ended country segment. Declared once here (not per sibling page)
// since it covers the whole [country] subtree (page.tsx, about/, legal/).
export function generateStaticParams() {
  return MARKETING_COUNTRIES.map((country) => ({ country }));
}

// Belt-and-suspenders with the notFound() check below: without this, Next
// would still attempt to render (and potentially 200) an arbitrary
// /[country] segment outside the static set on demand.
export const dynamicParams = false;

// Owns MarketingHeader/MarketingFooter for every /[country]/* page (not
// the parent (marketing)/layout.tsx, which sits above this dynamic
// segment and can't see params.country) — the footer's About/Legal links
// need the real country to stay on-market
// (SLD_IMPLEMENTATION_PLAN_austria-first.md §4.2).
export default async function CountryMarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  if (!isMarketingCountry(country)) notFound();

  return (
    <>
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter country={country} />
    </>
  );
}
